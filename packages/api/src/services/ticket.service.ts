import QRCode from "qrcode";
import { signWithEd25519, verifyEd25519Signature } from "../lib/crypto";

export interface TicketQrContent {
  tid: string;
  eid: string;
  sec: string;
  row: string;
  seat: string;
  ts: string;
}

export interface TicketQrEnvelope {
  payload: TicketQrContent;
  sig: string;
  pubkey: string;
}

export interface TicketClaimParams {
  id: string;
  eventId: string;
  section: string;
  row: string;
  seat: string;
}

export async function createSignedQrPayload(
  ticket: TicketClaimParams,
  privateKeyBase64: string,
  publicKeyBase64: string,
  suffixId?: string
): Promise<{ qrPayloadJson: string; qrPngDataUrl: string }> {
  const payload: TicketQrContent = {
    tid: suffixId ? `${ticket.id}#${suffixId}` : ticket.id,
    eid: ticket.eventId,
    sec: ticket.section,
    row: ticket.row,
    seat: ticket.seat,
    ts: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(payload);
  const signature = signWithEd25519(payloadString, privateKeyBase64);

  const envelope: TicketQrEnvelope = {
    payload,
    sig: signature,
    pubkey: publicKeyBase64,
  };

  const qrPayloadJson = JSON.stringify(envelope);
  const qrPngDataUrl = await QRCode.toDataURL(qrPayloadJson, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
  });

  return { qrPayloadJson, qrPngDataUrl };
}

export function verifySignedQrEnvelope(envelopeJson: string): {
  valid: boolean;
  expiredForDisplay: boolean;
  envelope?: TicketQrEnvelope;
  error?: string;
} {
  try {
    const envelope: TicketQrEnvelope = JSON.parse(envelopeJson);
    const payloadString = JSON.stringify(envelope.payload);

    const validSignature = verifyEd25519Signature(
      payloadString,
      envelope.sig,
      envelope.pubkey
    );

    if (!validSignature) {
      return { valid: false, expiredForDisplay: false, error: "Invalid cryptographic signature" };
    }

    const payloadDate = new Date(envelope.payload.ts).getTime();
    const ageHours = (Date.now() - payloadDate) / (1000 * 60 * 60);
    const expiredForDisplay = ageHours > 72;

    return {
      valid: true,
      expiredForDisplay,
      envelope,
    };
  } catch {
    return { valid: false, expiredForDisplay: false, error: "Malformed QR envelope" };
  }
}
