class IdentityManager {
  constructor() {
    this.identities = new Map();
    this.defaultIdentity = {
      name: 'Fake Identity',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
      isDefault: true
    };
    this.identities.set('Fake Identity', this.defaultIdentity);
  }
  
  createIdentity(name, avatar = null) {
    if (this.identities.has(name)) {
      return {
        success: false,
        message: `Une identité nommée "${name}" existe déjà.`
      };
    }
    
    const identity = {
      name,
      avatar: avatar || 'https://cdn.discordapp.com/embed/avatars/0.png',
      isDefault: false,
      createdAt: new Date()
    };
    
    this.identities.set(name, identity);
    
    return {
      success: true,
      identity
    };
  }
  
  deleteIdentity(name) {
    if (!this.identities.has(name)) {
      return {
        success: false,
        message: `L'identité "${name}" n'existe pas.`
      };
    }
    
    const identity = this.identities.get(name);
    
    if (identity.isDefault) {
      return {
        success: false,
        message: 'Vous ne pouvez pas supprimer l\'identité par défaut.'
      };
    }
    
    this.identities.delete(name);
    
    return {
      success: true
    };
  }
  
  modifyIdentity(name, newName = null, newAvatar = null) {
    if (!this.identities.has(name)) {
      return {
        success: false,
        message: `L'identité "${name}" n'existe pas.`
      };
    }
    
    if (newName && newName !== name && this.identities.has(newName)) {
      return {
        success: false,
        message: `Une identité nommée "${newName}" existe déjà.`
      };
    }
    
    const identity = this.identities.get(name);
    
    if (newName && newName !== name) {
      this.identities.delete(name);
      identity.name = newName;
      this.identities.set(newName, identity);
    }
    
    if (newAvatar) {
      identity.avatar = newAvatar;
    }
    
    identity.modifiedAt = new Date();
    
    return {
      success: true,
      identity
    };
  }
  
  getIdentity(name) {
    return this.identities.get(name);
  }
  
  getAllIdentities() {
    return Array.from(this.identities.values());
  }
  
  setDefaultIdentity(name, avatar = null) {
    for (const identity of this.identities.values()) {
      identity.isDefault = false;
    }
    
    let defaultIdentity = this.identities.get(name);
    
    if (!defaultIdentity) {
      defaultIdentity = this.createIdentity(name, avatar).identity;
    } else if (avatar) {
      defaultIdentity.avatar = avatar;
    }
    
    defaultIdentity.isDefault = true;
    this.defaultIdentity = defaultIdentity;
    
    return defaultIdentity;
  }
  
  getDefaultIdentity() {
    return this.defaultIdentity;
  }
}

module.exports = IdentityManager;
