require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const frontendPath = path.join(__dirname, '../frontend');

// Vérifie que le dossier frontend existe
if (!fs.existsSync(frontendPath)) {
    console.error("🚨 ERREUR : Le dossier frontend/ est introuvable !");
} else {
    console.log("✅ Dossier frontend/ trouvé !");
}

// Middleware
app.use(cors());
app.use(express.static(frontendPath));

// Redirection "/" vers "/Accueil"
app.get('/', (req, res) => {
    res.redirect('/Accueil');
});

// Servir les pages avec URL propre (ex: /Commande -> frontend/Commande/index.html)
app.get('/:page', (req, res, next) => {
    const page = req.params.page;

    // Sécuriser la route pour éviter d'accéder à des fichiers sensibles
    const allowedPages = ['Accueil', 'Commande', 'Panier', 'concel', 'success'];
    if (!allowedPages.includes(page)) {
        return res.status(404).send('Page non trouvée.');
    }

    const filePath = path.join(frontendPath, page, 'index.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Page non trouvée.');
    }
});

// Middleware spécial pour /webhook
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// Configurer Nodemailer
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ ERREUR : Identifiants iCloud manquants !");
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: false }
});

// Créer une session Stripe Checkout
app.post('/create-checkout-session', async (req, res) => {
    const { panier, emailClient } = req.body;

    if (!panier || panier.length === 0) {
        return res.status(400).json({ error: 'Le panier est vide.' });
    }

    try {
        const lineItems = panier.map(item => ({
            price_data: {
                currency: 'eur',
                product_data: {
                    name: item.nom,
                    description: item.composants ? item.composants.join(", ") : "Sans composants",
                },
                unit_amount: Math.round(item.prix * 100),
            },
            quantity: item.quantite,
        }));

        const orderDetails = panier.map(item => {
            const composants = item.composants ? item.composants.join(", ") : "Sans composants";
            return `${item.quantite}x ${item.nom} (${composants})`;
        }).join(", ");

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: 'https://lescrepesdenanou.onrender.com/success',
            cancel_url: 'https://lescrepesdenanou.onrender.com/concel',
            customer_email: emailClient,
            metadata: { orderDetails }
        });

        res.json({ id: session.id, url: session.url });
    } catch (err) {
        console.error("❌ Erreur Stripe :", err.message);
        res.status(500).send('Erreur lors de la création de la session');
    }
});

// Webhook Stripe
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log("✅ Webhook Stripe reçu :", event.type);
    } catch (err) {
        console.error("❌ Erreur Webhook :", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        const emailClient = session.customer_email || session.customer_details?.email;
        const montant = (session.amount_total / 100).toFixed(2);
        const detailsCommande = session.metadata?.orderDetails || "Commande inconnue";

        if (!emailClient) {
            console.error("❌ ERREUR : Email client introuvable !");
            return res.status(400).send("Erreur : Aucun e-mail associé à la commande.");
        }

        // Email confirmation client
        const mailOptionsClient = {
            from: `"Les Crêpes de Nanou" <${process.env.EMAIL_USER}>`,
            to: emailClient,
            subject: 'Confirmation de votre commande - Les Crêpes de Nanou',
            text: `Bonjour,\n\nMerci pour votre achat !\n\n🛍️ Votre commande :\n- ${detailsCommande}\n- Total : ${montant}€\n\nCordialement,\nLes Crêpes de Nanou`
        };

        transporter.sendMail(mailOptionsClient, (error) => {
            if (error) {
                console.error('❌ Erreur e-mail client :', error);
            } else {
                console.log(`📩 Email client envoyé : ${emailClient}`);
            }
        });

        // Email notification admin
        const mailOptionsAdmin = {
            from: `"Les Crêpes de Nanou" <${process.env.EMAIL_USER}>`,
            to: "ben.h21@icloud.com",
            subject: '📦 Nouvelle commande reçue !',
            text: `🚀 Nouvelle commande !\n\nClient : ${emailClient}\nCommande : ${detailsCommande}\nMontant : ${montant}€\n\nPrépare la commande vite !`
        };

        transporter.sendMail(mailOptionsAdmin, (error) => {
            if (error) {
                console.error('❌ Erreur e-mail admin :', error);
            } else {
                console.log(`📩 Notification admin envoyée`);
            }
        });

        return res.status(200).json({ received: true });
    }

    return res.status(400).send('Événement non pris en charge.');
});

// Lancer le serveur
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`✅ Serveur actif sur PORT ${PORT}`));
