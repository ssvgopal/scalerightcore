import { PrismaClient, AppointmentStatus, CommunicationChannel, MessageDirection, CallStatus, AppointmentSource } from "@prisma/client";

const prisma = new PrismaClient();

// Type check - should compile without errors
const appointmentStatus: AppointmentStatus = "BOOKED";
const channel: CommunicationChannel = "WHATSAPP";
const direction: MessageDirection = "INBOUND";
const callStatus: CallStatus = "COMPLETED";
const source: AppointmentSource = "MANUAL";

console.log("✓ All PatientFlow enums are available in the generated Prisma client");
