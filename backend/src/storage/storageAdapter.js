const { StorageConfigurationError } = require("./storageErrors")

class StorageAdapter {
  async upload() {
    throw new StorageConfigurationError("Storage upload is not implemented")
  }

  async read() {
    throw new StorageConfigurationError("Storage read is not implemented")
  }

  async exists() {
    throw new StorageConfigurationError("Storage exists is not implemented")
  }

  async delete() {
    throw new StorageConfigurationError("Storage delete is not implemented")
  }
}

module.exports = StorageAdapter
