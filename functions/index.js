const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

exports.tryLevel = functions.https.onCall(async (data, context) => {
  const maxLevel = 9
  const currentLevel = Number(data.currentLevel) || 0

  if (typeof currentLevel !== 'number' || currentLevel < 0 ||
      currentLevel > maxLevel || !Number.isInteger(currentLevel)) {
    throw new functions.https.HttpsError('invalid-argument', 'Nivel inválido')
  }

  const chance = (maxLevel - currentLevel) * 0.1
  const randomValue = Math.random()
  const success = randomValue < chance

  console.log(
    `tryLevel: currentLevel=${currentLevel}, ` +
    `chance=${chance}, randomValue=${randomValue}, success=${success}`
  )

  let newLevel = currentLevel
  let status = ''

  if (success && currentLevel < maxLevel) {
    newLevel = currentLevel + 1
    status = `Avanzaste al nivel ${newLevel}`
    console.log(`Éxito: newLevel=${newLevel}, status=${status}`)
  } else if (!success) {
    newLevel = 0
    status = 'Fallaste. Nivel reiniciado.'
    console.log(`Fallo: newLevel=${newLevel}, status=${status}`)
  } else {
    const winStatus = '¡Ganaste! Ingresa tu nombre.'
    const maxStatus = 'Nivel máximo alcanzado.'
    status = currentLevel === maxLevel ? winStatus : maxStatus
    console.log(`Caso especial: newLevel=${newLevel}, status=${status}`)
  }

  return {
    success,
    newLevel,
    status,
    nextChance: newLevel < maxLevel ? (maxLevel - newLevel) * 10 : 0
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
