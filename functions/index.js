// CONTEÚDO CORRETO E COMPLETO PARA: functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const stripePackage = require("stripe");

exports.createStripeCheckout = functions.https.onCall(async (data, context) => {
    // Lembre-se de colocar sua chave secreta de TESTE do Stripe aqui
    const stripe = stripePackage("sk_test_51RpFfW2fpb1gGSlpurSb98GJenvPL6ys2Ly8SPFFLtAAb76U55OJpZLTSxN1gjzEnzJc5MFWfRBEyGkg1eeJa6ic00IL174s1l");

    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado para fazer o upgrade.");
    }

    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            success_url: "http://localhost:5173/?upgrade=success",
            cancel_url: "http://localhost:5173/?upgrade=cancelled",
            client_reference_id: userId,
            line_items: [
                {
                    // Lembre-se de colocar seu ID de Preço correto aqui (price_...)
                    price: "price_1RpFkz2fpb1gGSlpVn5YA6Up", 
                    quantity: 1,
                },
            ],
        });

        return { url: session.url };

    } catch (error) {
        console.error("ERRO CRÍTICO AO FALAR COM O STRIPE:", error.message);
        throw new functions.https.HttpsError("internal", `Erro do Stripe: ${error.message}`);
    }
});