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

exports.attemptLevel = functions.https.onCall(async (data, context) => {
  // Log completo del request recibido
  functions.logger.log('Request received RAW:', {
    rawData: data,
    rawDataType: typeof data,
    auth: !!context.auth
  })

  // Validación más flexible y detallada
  try {
    // Verifica si data existe y es un objeto
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Request data must be an object',
        {receivedType: typeof data}
      )
    }

    // Verifica currentAttempt de forma más permisiva
    if (!data.currentAttempt || typeof data.currentAttempt !== 'object') {
      functions.logger.error('Invalid currentAttempt:', {
        hasCurrentAttempt: !!data.currentAttempt,
        currentAttemptType: typeof data.currentAttempt
      })
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Request must contain currentAttempt object',
        {received: data}
      )
    }

    // Extrae valores con defaults seguros
    const attempt = data.currentAttempt
    const level = typeof attempt.level === 'number' ? attempt.level : !isNaN(Number(attempt.level)) ? Number(attempt.level) : NaN
    const clientSeed = String(attempt.clientSeed || '')

    // Validación de valores
    if (isNaN(level) || level < 0 || level > 8) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Level must be a number between 0 and 8',
        {receivedLevel: attempt.level, convertedLevel: level}
      )
    }

    if (clientSeed.length < 8) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'clientSeed must be at least 8 characters',
        {receivedLength: clientSeed.length}
      )
    }

    // Lógica del juego
    const currentProbability = 0.9 - (level * 0.1)
    const success = Math.random() < currentProbability

    functions.logger.log('Attempt processed successfully', {
      level,
      currentProbability,
      success,
      nextLevel: success ? Math.min(level + 1, 8) : 0
    })

    return {
      success,
      probability: Math.round(currentProbability * 100),
      nextLevel: success ? Math.min(level + 1, 8) : 0,
      isMaxLevel: success && level >= 7
    }
  } catch (error) {
    functions.logger.error('Error processing attempt:', {
      error: error.message,
      stack: error.stack,
      details: error.details
    })

    // Reenviar errores conocidos
    if (error instanceof functions.https.HttpsError) {
      throw error
    }

    // Para errores desconocidos
    throw new functions.https.HttpsError(
      'internal',
      'An unexpected error occurred',
      {originalError: error.message}
    )
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
