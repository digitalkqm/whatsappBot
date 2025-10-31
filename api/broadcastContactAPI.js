const { createClient } = require('@supabase/supabase-js');

class BroadcastContactAPI {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Get all broadcast contacts across all lists
  async getAllContacts(filters = {}) {
    try {
      let query = this.supabase
        .from('broadcast_contacts')
        .select(`
          id,
          name,
          phone,
          email,
          tier,
          list_id,
          is_active,
          created_at,
          updated_at,
          contact_lists (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      if (filters.tier) {
        query = query.eq('tier', filters.tier);
      }

      if (filters.list_id) {
        query = query.eq('list_id', filters.list_id);
      }

      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Flatten the contact_lists object for easier frontend consumption
      const formattedData = data.map(contact => ({
        ...contact,
        list_name: contact.contact_lists?.name || null
      }));

      return { success: true, data: formattedData };

    } catch (error) {
      console.error('❌ Error getting all contacts:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get a single contact by ID
  async getContact(id) {
    try {
      const { data, error } = await this.supabase
        .from('broadcast_contacts')
        .select(`
          *,
          contact_lists (
            id,
            name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return { success: true, data };

    } catch (error) {
      console.error('❌ Error getting contact:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Create a contact list and add contacts to broadcast_contacts table
  async createContactList(listData) {
    try {
      const { name, description, contacts, source, source_config } = listData;

      if (!name || !contacts || !Array.isArray(contacts)) {
        throw new Error('Missing required fields: name, contacts (array)');
      }

      // Validate contacts
      this.validateContacts(contacts);

      // Create contact list first
      const { data: list, error: listError } = await this.supabase
        .from('contact_lists')
        .insert({
          name,
          description: description || null,
          source: source || 'manual',
          source_config: source_config || {},
          total_count: contacts.length
        })
        .select()
        .single();

      if (listError) throw listError;

      // Insert contacts into broadcast_contacts using upsert
      const contactsToInsert = contacts.map(contact => ({
        list_id: list.id,
        name: contact.name || '',
        phone: this.normalizePhone(contact.phone),
        email: contact.email || null,
        tier: contact.tier || 'Standard',
        preferred_contact: 'whatsapp',
        custom_fields: contact.custom_fields || {},
        is_active: true
      }));

      // Use upsert to handle duplicates: update if exists, insert if new
      const { data: insertedContacts, error: contactsError } = await this.supabase
        .from('broadcast_contacts')
        .upsert(contactsToInsert, {
          onConflict: 'list_id,phone', // Unique constraint columns
          ignoreDuplicates: false // Update existing records
        })
        .select();

      if (contactsError) {
        // Rollback: delete the contact list if contact insertion fails
        await this.supabase.from('contact_lists').delete().eq('id', list.id);
        throw contactsError;
      }

      console.log(`✅ Contact list created: ${name} (${list.id})`);
      return {
        success: true,
        data: {
          list,
          contacts: insertedContacts,
          count: insertedContacts.length
        }
      };

    } catch (error) {
      console.error('❌ Error creating contact list:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Update a single contact
  async updateContact(id, updates) {
    try {
      // Normalize phone if provided
      if (updates.phone) {
        updates.phone = this.normalizePhone(updates.phone);
      }

      const { data, error } = await this.supabase
        .from('broadcast_contacts')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Contact updated: ${id}`);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error updating contact:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Delete a single contact
  async deleteContact(id) {
    try {
      const { error } = await this.supabase
        .from('broadcast_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log(`✅ Contact deleted: ${id}`);
      return { success: true, message: 'Contact deleted successfully' };

    } catch (error) {
      console.error('❌ Error deleting contact:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Bulk delete contacts
  async bulkDeleteContacts(ids) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Invalid or empty contact IDs array');
      }

      const { error } = await this.supabase
        .from('broadcast_contacts')
        .delete()
        .in('id', ids);

      if (error) throw error;

      console.log(`✅ Bulk deleted ${ids.length} contacts`);
      return { success: true, message: `${ids.length} contacts deleted successfully` };

    } catch (error) {
      console.error('❌ Error bulk deleting contacts:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Import contacts from CSV
  async importFromCSV(csvData, listName, description) {
    try {
      // Parse CSV
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV file is empty or only contains headers');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      // Validate required headers
      if (!headers.includes('phone')) {
        throw new Error('CSV must have a "phone" column');
      }

      const contacts = [];
      const seenPhones = new Set(); // Track duplicates within CSV
      let duplicatesInCSV = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        const values = line.split(',').map(v => v.trim());
        const rowData = {};

        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        // Build contact object
        const contact = {
          name: rowData.name || '',
          phone: rowData.phone || '',
          email: rowData.email || '',
          tier: rowData.tier || 'Standard'
        };

        // Validate phone exists
        if (contact.phone) {
          // Normalize phone number
          const normalizedPhone = this.normalizePhone(contact.phone);

          // Check for duplicates within CSV
          if (seenPhones.has(normalizedPhone)) {
            duplicatesInCSV++;
            console.log(`⚠️  Skipping duplicate phone in CSV: ${contact.phone} (row ${i + 1})`);
            continue; // Skip this duplicate
          }

          seenPhones.add(normalizedPhone);
          contact.phone = normalizedPhone; // Use normalized phone

          // Validate tier value
          if (contact.tier && !['VIP', 'Premium', 'Standard'].includes(contact.tier)) {
            contact.tier = 'Standard';
          }
          contacts.push(contact);
        }
      }

      if (contacts.length === 0) {
        throw new Error('No valid contacts found in CSV');
      }

      if (duplicatesInCSV > 0) {
        console.log(`⚠️  Skipped ${duplicatesInCSV} duplicate phone numbers within CSV`);
      }

      // Create contact list with contacts
      const result = await this.createContactList({
        name: listName,
        description: description || `Imported from CSV on ${new Date().toISOString()}`,
        contacts,
        source: 'csv_import',
        source_config: {
          imported_at: new Date().toISOString(),
          original_count: contacts.length
        }
      });

      // Add duplicate count to result
      if (result.success && duplicatesInCSV > 0) {
        result.message = `Contact list created: ${contacts.length} contacts imported, ${duplicatesInCSV} duplicates within CSV were skipped`;
        result.data.duplicates_skipped = duplicatesInCSV;
      }

      return result;

    } catch (error) {
      console.error('❌ Error importing from CSV:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Validate contacts structure
  validateContacts(contacts) {
    if (!Array.isArray(contacts)) {
      throw new Error('Contacts must be an array');
    }

    if (contacts.length === 0) {
      throw new Error('Contacts array cannot be empty');
    }

    for (const contact of contacts) {
      if (!contact.phone) {
        throw new Error('Each contact must have a phone number');
      }

      // Validate phone format
      const normalized = this.normalizePhone(contact.phone);
      if (!/^\d{8,15}$/.test(normalized)) {
        throw new Error(`Invalid phone number format: ${contact.phone}`);
      }

      // Validate tier if provided
      if (contact.tier && !['VIP', 'Premium', 'Standard'].includes(contact.tier)) {
        throw new Error(`Invalid tier value: ${contact.tier}. Must be VIP, Premium, or Standard`);
      }
    }

    return true;
  }

  // Normalize phone number
  normalizePhone(phone) {
    if (!phone) return '';

    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Remove leading + if present
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }

    // If it starts with country code 65 (Singapore), keep it
    // Otherwise, assume it needs 65 prefix if it's 8 digits
    if (!normalized.startsWith('65') && normalized.length === 8) {
      normalized = '65' + normalized;
    }

    return normalized;
  }
}

module.exports = BroadcastContactAPI;
