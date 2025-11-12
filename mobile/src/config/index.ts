const Config = {
  API_URL: __DEV__
    ? 'http://localhost:3001'
    : 'https://api.restaurant-pos.com',
  WS_URL: __DEV__
    ? 'ws://localhost:3001'
    : 'wss://api.restaurant-pos.com',
  APP_NAME: 'Restaurant POS',
  VERSION: '2.0.0',
  FEATURES: {
    OFFLINE_MODE: true,
    QR_SCANNER: true,
    BIOMETRIC_AUTH: true,
  },
};

export default Config;
