const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

exports.tryLevel = functions.https.onCall(async (data, context) => {
  const maxLevel = 8
  let currentLevel = Number(data.currentLevel) || 0

  console.log('--- tryLevel v20250528 ---') // Identificador único
  console.log(`Input: currentLevel=${currentLevel}, type=${typeof currentLevel}`)

  if (typeof currentLevel !== 'number' || currentLevel < 0 ||
      currentLevel > maxLevel || !Number.isInteger(currentLevel)) {
    console.log('Error: Nivel inválido')
    throw new functions.https.HttpsError('invalid-argument', 'Nivel inválido')
  }

  const chance = (9 - currentLevel) * 0.1
  const randomValue = Math.random()
  const success = randomValue < chance

  console.log(`chance=${chance}, randomValue=${randomValue}, success=${success}`)

  let newLevel = currentLevel
  let status = ''

  console.log(`Evaluando: success=${success}, currentLevel=${currentLevel}, maxLevel=${maxLevel}`)
  if (success && currentLevel < maxLevel) {
    newLevel = currentLevel + 1
    currentLevel = newLevel
    status = `Avanzaste al nivel ${newLevel}`
    console.log(`Éxito: newLevel=${newLevel}, status=${status}`)
  } else if (success && currentLevel === maxLevel) {
    newLevel = maxLevel
    status = '¡Ganaste! Ingresa tu nombre.'
    console.log(`Ganador: newLevel=${newLevel}, status=${status}`)
  } else {
    newLevel = 0
    status = 'Fallaste. Nivel reiniciado.'
    console.log(`Fallo: newLevel=${newLevel}, status=${status}`)
  }

  const nextChance = newLevel < maxLevel ? (9 - newLevel) * 10 : 0
  console.log(`Respuesta: success=${success}, newLevel=${newLevel}, status=${status}, nextChance=${nextChance}`)

  return {
    success,
    currentLevel,
    newLevel,
    status,
    nextChance
  }
})

exports.updateLastWin = functions.https.onCall(async (data, context) => {
  const playerName = data.playerName
  if (typeof playerName !== 'string' || playerName.trim() === '') {
    throw new functions.https.HttpsError('invalid-argument', 'Nombre inválido')
  }

  const timestamp = admin.firestore.Timestamp.now()
  await admin.firestore()
    .collection('levelCompletion')
    .doc('lastCompletion')
    .set({timestamp, name: playerName})

  return {success: true, message: 'Última victoria actualizada'}
})
