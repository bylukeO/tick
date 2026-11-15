import crypto from "node:crypto";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const { encodeBase64, decodeBase64 } = naclUtil;

const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const SCRYPT_KEY_LENGTH = 32;

export interface EncryptedKeyRecord {
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface UserKeyPair {
  publicKey: string;
  privateKey: string;
}

export function generateEd25519KeyPair(): UserKeyPair {
  const pair = nacl.sign.keyPair();
  return {
    publicKey: encodeBase64(pair.publicKey),
    privateKey: encodeBase64(pair.secretKey),
  };
}

export function encryptPrivateKey(privateKeyBase64: string, password: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH);

  const cipher = crypto.createCipheriv(AES_ALGORITHM, derivedKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(privateKeyBase64, "utf8")),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const record: EncryptedKeyRecord = {
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };

  return JSON.stringify(record);
}

export function decryptPrivateKey(encryptedRecordJson: string, password: string): string {
  const record: EncryptedKeyRecord = JSON.parse(encryptedRecordJson);
  const salt = Buffer.from(record.salt, "base64");
  const iv = Buffer.from(record.iv, "base64");
  const authTag = Buffer.from(record.authTag, "base64");
  const ciphertext = Buffer.from(record.ciphertext, "base64");

  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function createCanonicalTransferDoc(data: {
  ticketId: string;
  from: string;
  to: string;
  ts: string;
  nonce: string;
}): string {
  const sortedKeys = Object.keys(data).sort() as Array<keyof typeof data>;
  const orderedObject: Record<string, string> = {};
  for (const key of sortedKeys) {
    orderedObject[key] = data[key];
  }
  return JSON.stringify(orderedObject);
}

export function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}

export function signWithEd25519(message: string, privateKeyBase64: string): string {
  const secretKey = decodeBase64(privateKeyBase64);
  const messageBytes = Buffer.from(message, "utf8");
  const signatureBytes = nacl.sign.detached(messageBytes, secretKey);
  return encodeBase64(signatureBytes);
}

export function verifyEd25519Signature(
  message: string,
  signatureBase64: string,
  publicKeyBase64: string
): boolean {
  try {
    const signature = decodeBase64(signatureBase64);
    const publicKey = decodeBase64(publicKeyBase64);
    const messageBytes = Buffer.from(message, "utf8");
    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch {
    return false;
  }
}
