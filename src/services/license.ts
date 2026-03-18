export type LicenseTier = 'free' | 'premium';

export interface LicenseStatus {
  tier: LicenseTier;
  priceMonthly: string;
  priceYearly: string;
  priceLifetime: string;
}

class LicenseService {
  private currentTier: LicenseTier = 'free';

  constructor() {
    // In a real app, we would check chrome.storage.local or an API
    this.currentTier = localStorage.getItem('vault_license_tier') as LicenseTier || 'free';
  }

  getLicenseStatus(): LicenseStatus {
    return {
      tier: this.currentTier,
      priceMonthly: '$1.99',
      priceYearly: '$14.99',
      priceLifetime: '$49.99'
    };
  }

  async verifyLicense(key: string): Promise<boolean> {
    // 1. Check for the "Friends & Family" backdoor
    if (key === 'BRAIN-VAULT-FAMILY-2026') {
      await this.upgradeToPremium();
      return true;
    }

    // 2. In a real production environment, you would call your backend 
    // to verify the LemonSqueezy license key via their API.
    // For now, since we are local-first, the backdoor is our primary "special" activation.
    return false;
  }

  isPremium(): boolean {
    return this.currentTier === 'premium';
  }

  async upgradeToPremium() {
    this.currentTier = 'premium';
    localStorage.setItem('vault_license_tier', 'premium');
    return true;
  }

  async openCheckout(plan: 'monthly' | 'yearly' | 'lifetime') {
    // In production, these would be your real LemonSqueezy checkout URLs
    const checkoutUrls = {
      monthly: 'https://toxminds.lemonsqueezy.com/checkout/buy/82831f38-6c76-403d-bfdb-4948bcc5abea',
      yearly: 'https://toxminds.lemonsqueezy.com/checkout/buy/b446dc9d-8f3d-4a48-b6f9-c77565d4dfec',
      lifetime: 'https://toxminds.lemonsqueezy.com/checkout/buy/4fe85453-d573-49a4-a890-c31d71738f56'
    };
    
    window.open(checkoutUrls[plan], '_blank');
  }

  async resetToFree() {
    this.currentTier = 'free';
    localStorage.setItem('vault_license_tier', 'free');
    return true;
  }
}

export const licenseService = new LicenseService();
