// functions/index.js

const functions = require("firebase-functions");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const stripePackage = require("stripe");

admin.initializeApp();

// --- FUNÇÃO DE CHECKOUT DE PRODUÇÃO ---
exports.createStripeCheckout = onCall(async (request) => {
    const stripe = stripePackage("sk_test_51RpFfW2fpb1gGSlpurSb98GJenvPL6ys2Ly8SPFFLtAAb76U55OJpZLTSxN1gjzEnzJc5MFWfRBEyGkg1eeJa6ic00IL174s1l");

    if (!request.auth) {
        functions.logger.error("Tentativa de checkout não autenticada.");
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado para fazer o upgrade.");
    }

    const userId = request.auth.uid;
    const userEmail = request.auth.token.email;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            success_url: "https://controle-de-cartao.web.app/?upgrade=success", 
            cancel_url: "https://controle-de-cartao.web.app/?upgrade=cancelled",
            client_reference_id: userId,
            customer_email: userEmail,
            line_items: [
                {
                    price: "price_1RpFkz2fpb1gGSlpVn5YA6Up",
                    quantity: 1,
                },
            ],
        });

        return { url: session.url };

    } catch (error) {
        functions.logger.error("Erro ao criar a sessão de checkout do Stripe:", error);
        throw new functions.https.HttpsError("internal", "Não foi possível criar a sessão de checkout.");
    }
});
