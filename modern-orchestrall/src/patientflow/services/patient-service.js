const database = require('../../database');
const logger = require('../../utils/logger');

class PatientService {
  constructor() {
    this.prismaClient = null;
  }

  get prisma() {
    if (!this.prismaClient) {
      this.prismaClient = database.client;
    }

    return this.prismaClient;
  }

  normalizeWhatsAppNumber(number) {
    if (!number) {
      return null;
    }

    let normalized = `${number}`.trim();
    normalized = normalized.replace(/^whatsapp:/i, '').replace(/\s+/g, '');

    if (!normalized.startsWith('+') && /^\d+$/.test(normalized)) {
      normalized = `+${normalized}`;
    }

    return normalized;
  }

  deriveName(profileName, waId) {
    if (profileName && profileName.trim()) {
      const parts = profileName.trim().split(/\s+/);
      const firstName = this.capitalize(parts.shift());
      const lastName = parts.length > 0 ? this.capitalize(parts.join(' ')) : 'Patient';

      return { firstName, lastName };
    }

    if (waId) {
      return {
        firstName: 'WhatsApp',
        lastName: `Patient${waId.slice(-4)}`,
      };
    }

    return {
      firstName: 'WhatsApp',
      lastName: 'Patient',
    };
  }

  capitalize(value) {
    if (!value) {
      return '';
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  async resolveOrCreatePatient({
    organizationId,
    fromNumber,
    waId,
    profileName,
  }) {
    const normalizedNumber = this.normalizeWhatsAppNumber(fromNumber || waId);

    if (!organizationId) {
      throw new Error('Missing organizationId for patient resolution');
    }

    if (!normalizedNumber) {
      throw new Error('Unable to resolve phone number from WhatsApp sender');
    }

    try {
      const compositeKey = {
        organizationId_phone: {
          organizationId,
          phone: normalizedNumber,
        },
      };

      let patient = await this.prisma.patient.findUnique({
        where: compositeKey,
      });

      const metadataPatch = {
        source: 'whatsapp',
        waId,
        profileName,
        lastWhatsAppInteractionAt: new Date().toISOString(),
      };

      if (patient) {
        const nextMetadata = Object.assign({}, patient.metadata || {}, metadataPatch);
        const updateData = {
          metadata: nextMetadata,
        };

        if (!patient.whatsappOptIn) {
          updateData.whatsappOptIn = true;
        }

        if (!patient.phoneOptIn) {
          updateData.phoneOptIn = true;
        }

        patient = await this.prisma.patient.update({
          where: compositeKey,
          data: updateData,
        });

        return patient;
      }

      const { firstName, lastName } = this.deriveName(profileName, waId || normalizedNumber);

      patient = await this.prisma.patient.create({
        data: {
          organizationId,
          firstName: firstName || 'WhatsApp',
          lastName: lastName || 'Patient',
          phone: normalizedNumber,
          whatsappOptIn: true,
          phoneOptIn: true,
          smsOptIn: true,
          metadata: metadataPatch,
        },
      });

      logger.info('Created new patient from WhatsApp conversation', {
        patientId: patient.id,
        organizationId,
      });

      return patient;
    } catch (error) {
      logger.error('Failed to resolve or create patient', {
        organizationId,
        fromNumber,
        error: error.message,
      });

      throw error;
    }
  }
}

module.exports = new PatientService();
