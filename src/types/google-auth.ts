interface ProviderUserInfo {
  providerId: string;
  displayName?: string;
  photoUrl?: string;
  federatedId?: string;
  email?: string;
  rawId?: string;
  screenName?: string;
  phoneNumber?: string;
}

export interface SetAccountInfoResponse {
  kind: string;
  localId: string;
  email: string;
  displayName: string;
  idToken: string;
  providerUserInfo: ProviderUserInfo[];
  newEmail: string;
  photoUrl: string;
  refreshToken: string;
  expiresIn: string;
  passwordHash: string;
  emailVerified: boolean;
}
