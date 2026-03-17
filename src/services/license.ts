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
      priceMonthly: '$0.89',
      priceYearly: '$4.99',
      priceLifetime: '$7.99'
    };
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
      monthly: 'https://vault.lemonsqueezy.com/checkout/buy/monthly-plan',
      yearly: 'https://vault.lemonsqueezy.com/checkout/buy/yearly-plan',
      lifetime: 'https://vault.lemonsqueezy.com/checkout/buy/lifetime-plan'
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
