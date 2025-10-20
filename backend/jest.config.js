module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.test.ts'],
  testTimeout: 10000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Set test environment variables
  testEnvironmentOptions: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test_user:test_password@localhost:5432/restaurant_pos_test?schema=public',
      JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
      SQUARE_ACCESS_TOKEN: 'test_square_token',
      SQUARE_LOCATION_ID: 'test_location_id',
      SQUARE_APPLICATION_ID: 'test_application_id',
      SQUARE_ENVIRONMENT: 'sandbox',
      TWILIO_ACCOUNT_SID: 'test_twilio_sid',
      TWILIO_AUTH_TOKEN: 'test_twilio_token',
      TWILIO_PHONE_NUMBER: '+1234567890',
      HUGGINGFACE_API_KEY: 'test_huggingface_key',
      PORT: '3001',
      FRONTEND_URL: 'http://localhost:3000',
      LOG_LEVEL: 'error',
      SQUARE_WEBHOOK_SECRET: 'test_webhook_secret'
    }
  }
};
