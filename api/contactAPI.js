const { createClient } = require('@supabase/supabase-js');

class ContactAPI {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Create a new contact list
  async createContactList(listData) {
    try {
      const { name, description, contacts, source, source_config, tags } = listData;

      // Validate required fields
      if (!name || !contacts || !Array.isArray(contacts)) {
        throw new Error('Missing required fields: name, contacts (array)');
      }

      // Validate contacts structure
      this.validateContacts(contacts);

      const { data, error } = await this.supabase
        .from('contact_lists')
        .insert({
          name,
          description: description || null,
          contacts,
          source: source || 'manual',
          source_config: source_config || {},
          tags: tags || [],
          total_count: contacts.length
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Contact list created: ${name} (${data.id})`);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error creating contact list:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get all contact lists
  async getContactLists(filters = {}) {
    try {
      let query = this.supabase
        .from('contact_lists')
        .select('id, name, description, source, tags, total_count, created_at, updated_at')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.source) {
        query = query.eq('source', filters.source);
      }

      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      if (filters.tag) {
        query = query.contains('tags', [filters.tag]);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('❌ Error getting contact lists:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get contact list by ID (with full contacts)
  async getContactList(id) {
    try {
      const { data, error } = await this.supabase
        .from('contact_lists')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('❌ Error getting contact list:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Update contact list
  async updateContactList(id, updates) {
    try {
      // Recalculate total_count if contacts were updated
      if (updates.contacts && Array.isArray(updates.contacts)) {
        this.validateContacts(updates.contacts);
        updates.total_count = updates.contacts.length;
      }

      const { data, error } = await this.supabase
        .from('contact_lists')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Contact list updated: ${id}`);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error updating contact list:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Delete contact list
  async deleteContactList(id) {
    try {
      const { error } = await this.supabase.from('contact_lists').delete().eq('id', id);

      if (error) throw error;

      console.log(`✅ Contact list deleted: ${id}`);
      return { success: true, message: 'Contact list deleted successfully' };
    } catch (error) {
      console.error('❌ Error deleting contact list:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Add contacts to existing list
  async addContacts(id, newContacts) {
    try {
      // Get existing list
      const { data: list, error: getError } = await this.supabase
        .from('contact_lists')
        .select('contacts')
        .eq('id', id)
        .single();

      if (getError) throw getError;

      // Validate new contacts
      this.validateContacts(newContacts);

      // Merge contacts (avoid duplicates by phone number)
      const existingPhones = new Set(list.contacts.map(c => c.phone));
      const uniqueNewContacts = newContacts.filter(c => !existingPhones.has(c.phone));

      const updatedContacts = [...list.contacts, ...uniqueNewContacts];

      // Update list
      const { data, error } = await this.supabase
        .from('contact_lists')
        .update({
          contacts: updatedContacts,
          total_count: updatedContacts.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Added ${uniqueNewContacts.length} contacts to list ${id}`);
      return { success: true, data, added_count: uniqueNewContacts.length };
    } catch (error) {
      console.error('❌ Error adding contacts:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Remove contacts from list
  async removeContacts(id, phonesToRemove) {
    try {
      // Get existing list
      const { data: list, error: getError } = await this.supabase
        .from('contact_lists')
        .select('contacts')
        .eq('id', id)
        .single();

      if (getError) throw getError;

      // Filter out contacts
      const phoneSet = new Set(phonesToRemove);
      const updatedContacts = list.contacts.filter(c => !phoneSet.has(c.phone));

      // Update list
      const { data, error } = await this.supabase
        .from('contact_lists')
        .update({
          contacts: updatedContacts,
          total_count: updatedContacts.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const removedCount = list.contacts.length - updatedContacts.length;
      console.log(`✅ Removed ${removedCount} contacts from list ${id}`);
      return { success: true, data, removed_count: removedCount };
    } catch (error) {
      console.error('❌ Error removing contacts:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Import contacts from CSV data
  async importFromCSV(csvData, listName, mapping = {}) {
    try {
      // Parse CSV (simple implementation - you may want to use a library like csv-parse)
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      // Default mapping
      const nameCol = mapping.name || 'name';
      const phoneCol = mapping.phone || 'phone';
      const emailCol = mapping.email || 'email';

      const contacts = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const rowData = {};

        headers.forEach((header, index) => {
          rowData[header] = values[index];
        });

        // Build contact object
        const contact = {
          name: rowData[nameCol] || '',
          phone: this.normalizePhone(rowData[phoneCol] || ''),
          email: rowData[emailCol] || '',
          custom_fields: {}
        };

        // Add remaining fields as custom fields
        for (const [key, value] of Object.entries(rowData)) {
          if (key !== nameCol && key !== phoneCol && key !== emailCol) {
            contact.custom_fields[key] = value;
          }
        }

        // Validate phone number exists
        if (contact.phone) {
          contacts.push(contact);
        }
      }

      // Create contact list
      return await this.createContactList({
        name: listName,
        description: `Imported from CSV on ${new Date().toISOString()}`,
        contacts,
        source: 'csv_import',
        tags: ['imported', 'csv']
      });
    } catch (error) {
      console.error('❌ Error importing from CSV:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get WhatsApp groups (via WhatsApp client)
  async getWhatsAppGroups(client) {
    try {
      if (!client) {
        throw new Error('WhatsApp client not provided');
      }

      const chats = await client.getChats();
      const groups = chats
        .filter(chat => chat.isGroup)
        .map(group => ({
          id: group.id._serialized,
          name: group.name,
          participant_count: group.participants ? group.participants.length : 0
        }));

      return { success: true, data: groups };
    } catch (error) {
      console.error('❌ Error getting WhatsApp groups:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Validate contacts structure
  validateContacts(contacts) {
    if (!Array.isArray(contacts)) {
      throw new Error('Contacts must be an array');
    }

    for (const contact of contacts) {
      if (!contact.phone) {
        throw new Error('Each contact must have a phone number');
      }

      // Validate phone format (basic)
      if (!/^\d{8,15}$/.test(contact.phone.replace(/[\s\-+()]/g, ''))) {
        throw new Error(`Invalid phone number format: ${contact.phone}`);
      }
    }

    return true;
  }

  // Normalize phone number (remove spaces, dashes, etc.)
  normalizePhone(phone) {
    if (!phone) return '';

    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Remove leading + if present
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }

    // If it starts with country code 65 (Singapore), keep it
    // Otherwise, assume it needs 65 prefix
    if (!normalized.startsWith('65') && normalized.length === 8) {
      normalized = '65' + normalized;
    }

    return normalized;
  }

  // Get contact list statistics
  async getStatistics(id) {
    try {
      const { data: list, error } = await this.supabase
        .from('contact_lists')
        .select('contacts, tags')
        .eq('id', id)
        .single();

      if (error) throw error;

      const stats = {
        total_contacts: list.contacts.length,
        with_email: list.contacts.filter(c => c.email).length,
        with_custom_fields: list.contacts.filter(
          c => c.custom_fields && Object.keys(c.custom_fields).length > 0
        ).length,
        tags: list.tags || [],
        unique_custom_fields: this.getUniqueCustomFields(list.contacts)
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('❌ Error getting statistics:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get unique custom field names across all contacts
  getUniqueCustomFields(contacts) {
    const fields = new Set();

    for (const contact of contacts) {
      if (contact.custom_fields) {
        Object.keys(contact.custom_fields).forEach(key => fields.add(key));
      }
    }

    return Array.from(fields);
  }
}

module.exports = ContactAPI;
