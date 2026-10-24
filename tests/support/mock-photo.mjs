// In-memory stand-in for "@/lib/photo" (QA_MOCK=1). Tests must not touch the real filesystem.
// The alias loader swaps this file in only from the point QA_MOCK is set.
export const saved = [];

export async function saveParticipantPhoto(photoBase64, participantId) {
  saved.push({ photoBase64, participantId });
  return `uploads/participants/${participantId}.png`;
}

export async function deleteParticipantPhoto() {}
