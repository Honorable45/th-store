/**
 * Lecture et validation des variables d'environnement.
 * L'application refuse de démarrer si une valeur obligatoire est absente ou invalide.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  webOrigin: string;
  adminOrigin: string;
  apiPublicUrl: string;
  timezone: string;
  appSecret: string;
  encryptionKey: Buffer;
  sessionTtlHours: number;
  cookieSecure: boolean;
  storage: {
    driver: 'local' | 's3';
    localDir: string;
    s3: {
      endpoint?: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicUrl: string;
    };
  };
  paygateApiKey?: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value.trim();
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const appSecret = required('APP_SECRET');
  if (appSecret.length < 32) {
    throw new Error('APP_SECRET doit contenir au moins 32 caractères.');
  }

  const encryptionKey = Buffer.from(required('DATA_ENCRYPTION_KEY'), 'base64');
  if (encryptionKey.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY doit représenter exactement 32 octets encodés en base64.');
  }

  const driver = (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3';
  if (driver !== 'local' && driver !== 's3') {
    throw new Error('STORAGE_DRIVER doit valoir "local" ou "s3".');
  }

  const port = Number(process.env.PORT ?? 4000);

  cached = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port,
    webOrigin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, ''),
    adminOrigin: (process.env.ADMIN_ORIGIN ?? 'http://localhost:3001').replace(/\/$/, ''),
    apiPublicUrl: (process.env.API_PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
    timezone: process.env.BUSINESS_TIMEZONE ?? 'Africa/Lome',
    appSecret,
    encryptionKey,
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    storage: {
      driver,
      localDir: process.env.LOCAL_UPLOAD_DIR ?? './uploads',
      s3: {
        endpoint: process.env.S3_ENDPOINT || undefined,
        region: process.env.S3_REGION ?? 'auto',
        bucket: driver === 's3' ? required('S3_BUCKET') : '',
        accessKeyId: driver === 's3' ? required('S3_ACCESS_KEY_ID') : '',
        secretAccessKey: driver === 's3' ? required('S3_SECRET_ACCESS_KEY') : '',
        publicUrl: driver === 's3' ? required('S3_PUBLIC_URL').replace(/\/$/, '') : '',
      },
    },
    paygateApiKey: process.env.PAYGATE_API_KEY?.trim() || undefined,
  };
  return cached;
}

/** Réservé aux tests : force la relecture de l'environnement. */
export function resetConfigCache() {
  cached = null;
}
