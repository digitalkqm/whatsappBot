const ImageKit = require('imagekit');

class ImageUploadAPI {
  constructor(publicKey, privateKey, urlEndpoint) {
    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new Error('ImageKit credentials are required');
    }

    this.imagekit = new ImageKit({
      publicKey: publicKey,
      privateKey: privateKey,
      urlEndpoint: urlEndpoint
    });
  }

  /**
   * Upload image to ImageKit from buffer
   * @param {Buffer} fileBuffer - Image file buffer
   * @param {String} fileName - Original file name
   * @param {String} folder - Optional folder path in ImageKit
   * @returns {Promise<Object>} Upload result with URL
   */
  async uploadImage(fileBuffer, fileName, folder = 'broadcast-images') {
    try {
      const result = await this.imagekit.upload({
        file: fileBuffer,
        fileName: fileName,
        folder: folder,
        useUniqueFileName: true,
        tags: ['whatsapp-broadcast'],
        // Optional transformations
        transformation: {
          pre: 'auto', // Auto-optimize image
          post: [
            {
              type: 'transformation',
              value: 'w-1200,h-1200,c-at_max' // Max 1200x1200 for WhatsApp
            }
          ]
        }
      });

      return {
        success: true,
        url: result.url,
        fileId: result.fileId,
        name: result.name,
        size: result.size,
        width: result.width,
        height: result.height
      };
    } catch (error) {
      console.error('❌ ImageKit upload error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete image from ImageKit
   * @param {String} fileId - ImageKit file ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteImage(fileId) {
    try {
      await this.imagekit.deleteFile(fileId);
      return {
        success: true,
        message: 'Image deleted successfully'
      };
    } catch (error) {
      console.error('❌ ImageKit delete error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get authentication parameters for client-side upload
   * Used for direct browser uploads (optional)
   * @returns {Object} Authentication parameters
   */
  getAuthenticationParameters() {
    const authenticationParameters = this.imagekit.getAuthenticationParameters();
    return {
      token: authenticationParameters.token,
      expire: authenticationParameters.expire,
      signature: authenticationParameters.signature
    };
  }

  /**
   * List all uploaded images
   * @param {Number} limit - Number of images to retrieve
   * @param {Number} skip - Number of images to skip
   * @returns {Promise<Object>} List of images
   */
  async listImages(limit = 50, skip = 0) {
    try {
      const result = await this.imagekit.listFiles({
        skip: skip,
        limit: limit,
        tags: 'whatsapp-broadcast'
      });

      return {
        success: true,
        files: result
      };
    } catch (error) {
      console.error('❌ ImageKit list error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ImageUploadAPI;
