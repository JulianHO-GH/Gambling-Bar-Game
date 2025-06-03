const functions = require('firebase-functions')
const admin = require('firebase-admin')
const crypto = require('crypto')

admin.initializeApp()
// Función para limpiar objetos antes de logging
function safeStringify (obj) {
  const seen = new WeakSet()
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    return value
  })
}

// Game configuration
const GAME_CONFIG = {
  maxLevel: 8,
  initialProbability: 0.9, // 90% chance at level 0
  probabilityStep: 0.1 // Decreases by 10% each level
}

exports.attemptLevel = functions.https.onCall((data, context) => {
  // Firebase YA extrajo el contenido de data.data para nosotros
  // data ya ES el currentAttempt directamente

  // Validación mejorada
  if (!data || typeof data !== 'object') {
    functions.logger.error('Invalid request format', {received: typeof data})
    throw new functions.https.HttpsError('invalid-argument', 'Invalid request format')
  }

  // Extrae valores con conversión explícita
  const level = parseInt(data.level, 10)
  const clientSeed = String(data.clientSeed || '')
  // Validación de nivel
  /*if (isNaN(level)) {
    functions.logger.error('Invalid level type', {
      received: data.level,
      type: typeof data.level
    })
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Level must be a number',
      {received: data.level}
    )
  }
*/
  if (level < 0 || level > 8) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Level must be between 0 and 8',
      {received: level}
    )
  }
  // Validación de clientSeed
  /*if (clientSeed.length < 8) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'clientSeed must be at least 8 characters',
      {length: clientSeed.length}
    )
  }*/
  // Lógica del juego
  const probability = 0.9 - (level * 0.1)
  const success = Math.random() < probability

  // Respuesta
  return {
    success,
    probability: Math.round(probability * 100),
    nextLevel: success ? Math.min(level + 1, 8) : 0,
    isMaxLevel: success && level >= 7
  }
})

exports.recordWinner = functions.https.onCall(async (data, context) => {
  // Basic validation
  if (typeof data !== 'object' || data === null) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid data format')
  }

  const {playerName, finalLevel, verificationData} = data

  // Validate player name
  if (typeof playerName !== 'string' || playerName.trim().length < 2) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Player name must be at least 2 characters'
    )
  }

  // Validate level (optional, could verify against verificationData)
  if (typeof finalLevel !== 'number' || finalLevel !== GAME_CONFIG.maxLevel) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid completion level'
    )
  }

  // Store the winner with server timestamp
  try {
    await admin.firestore()
      .collection('winners')
      .doc('latest')
      .set({
        name: playerName.trim(),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        level: finalLevel,
        verified: Boolean(verificationData) // Could add more verification later
      })

    return {
      status: 'SUCCESS',
      message: 'Winner recorded successfully'
    }
  } catch (error) {
    console.error('Error recording winner:', error)
    throw new functions.https.HttpsError(
      'internal',
      'Failed to record winner'
    )
  }
})

// Función auxiliar mejorada
function generateServerSeed () {
  return require('crypto').randomBytes(16).toString('hex')
}

// Función auxiliar mejorada
function generateDeterministicOutcome (seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex')
  const intValue = parseInt(hash.substring(0, 8), 16)
  return (intValue % 10000) / 10000
}
