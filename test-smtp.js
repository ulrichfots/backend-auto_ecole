#!/usr/bin/env node

/**
 * Script de test SMTP
 * Teste la connexion à Gmail SMTP
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('🧪 Test de connexion SMTP Gmail...\n');
  
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  console.log('📋 Configuration:');
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   User: ${user ? user.substring(0, 5) + '***' : 'NON DÉFINI'}`);
  console.log(`   Pass: ${pass ? '***' + pass.substring(pass.length - 3) : 'NON DÉFINI'}\n`);

  if (!user || !pass) {
    console.error('❌ ERREUR: Identifiants manquants dans .env');
    console.error('   Vérifiez SMTP_USER et SMTP_PASS dans votre fichier .env');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    socketTimeout: 15000,
    tls: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Vérification de la connexion...');
    await transporter.verify();
    console.log('✅ Connexion SMTP réussie!\n');

    // Test d'envoi
    console.log('📧 Test d\'envoi d\'email...');
    const result = await transporter.sendMail({
      from: `"Auto École Test" <${user}>`,
      to: user, // Envoyer à soi-même pour test
      subject: '✅ Test SMTP - Auto École',
      html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2>✅ Connexion SMTP fonctionnelle!</h2>
          <p>Cet email de test prouve que le service SMTP est correctement configuré.</p>
          <p style="color: #666; font-size: 12px;">
            Serveur: ${host}:${port}<br>
            Utilisateur: ${user}
          </p>
        </div>
      `
    });

    console.log('✅ Email envoyé avec succès!');
    console.log(`   Message ID: ${result.messageId}\n`);
    console.log('🎉 Tout fonctionne correctement!');
    process.exit(0);

  } catch (error) {
    console.error('❌ ERREUR SMTP:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error(`   Command: ${error.command}\n`);

    if (error.code === 'EAUTH') {
      console.error('💡 Suggestion: Vérifiez vos identifiants Gmail');
      console.error('   - Pour Gmail, utilisez un mot de passe d\'application (16 caractères)');
      console.error('   - Activez les applis moins sûres si c\'est un compte classique');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Suggestion: Vérifiez la connexion réseau et les paramètres host/port');
    }

    process.exit(1);
  }
}

testSMTP();
