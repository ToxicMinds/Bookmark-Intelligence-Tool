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
      priceMonthly: '$0.49',
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

  async resetToFree() {
    this.currentTier = 'free';
    localStorage.setItem('vault_license_tier', 'free');
    return true;
  }
}

export const licenseService = new LicenseService();
