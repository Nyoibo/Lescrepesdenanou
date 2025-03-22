// script.js

let panier = JSON.parse(localStorage.getItem('panier')) || [];

function ajouterAuPanier(nom, prix) {
    const compteurPanier = document.getElementById('compteur-panier');
    const index = panier.findIndex(item => item.nom === nom);
    if (index !== -1) {
        panier[index].quantite += 1;
    } else {
        panier.push({ nom, prix, quantite: 1 });
    }

    localStorage.setItem('panier', JSON.stringify(panier));
    mettreAJourPanier();
    mettreAJourCompteur();
    effetPanier();

    compteurPanier.classList.add('panier-anim');
    setTimeout(() => compteurPanier.classList.remove('panier-anim'), 500);
}

function effetPanier() {
    const boutonPanier = document.querySelector(".btn-panier");
    boutonPanier.classList.add("panier-highlight", "panier-clignote");
    setTimeout(() => boutonPanier.classList.remove("panier-highlight", "panier-clignote"), 2000);
}

function mettreAJourCompteur() {
    const compteurPanier = document.getElementById("compteur-panier");
    const totalArticles = panier.reduce((total, item) => total + item.quantite, 0);
    compteurPanier.innerText = totalArticles;
}

function mettreAJourPanier() {
    const tablePanier = document.querySelector("#table-panier tbody");
    const totalPanier = document.getElementById("total-panier");
    const boutonValider = document.querySelector(".btn-payer");

    if (!tablePanier || !totalPanier) return;

    tablePanier.innerHTML = "";
    let total = 0;

    panier.forEach((article, index) => {
        const totalArticle = article.prix * article.quantite;
        total += totalArticle;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${article.nom}</td>
            <td>${article.prix.toFixed(2)} €</td>
            <td><input type="number" value="${article.quantite}" min="1" onchange="modifierQuantite(${index}, this.value)" /></td>
            <td>${totalArticle.toFixed(2)} €</td>
            <td><button class="btn-supprimer" onclick="supprimerDuPanier(${index})">❌</button></td>
        `;
        tablePanier.appendChild(tr);
    });

    totalPanier.innerText = `${total.toFixed(2)} €`;

    if (panier.length === 0) {
        boutonValider.setAttribute("disabled", "true");
        boutonValider.classList.add("btn-disabled");
    } else {
        boutonValider.removeAttribute("disabled");
        boutonValider.classList.remove("btn-disabled");
    }
}

function modifierQuantite(index, nouvelleQuantite) {
    if (nouvelleQuantite < 1) return;
    panier[index].quantite = parseInt(nouvelleQuantite);
    localStorage.setItem('panier', JSON.stringify(panier));
    mettreAJourPanier();
}

function supprimerDuPanier(index) {
    panier.splice(index, 1);
    localStorage.setItem('panier', JSON.stringify(panier));
    mettreAJourPanier();
    mettreAJourCompteur();
}

async function passerAuPaiement() {
    if (panier.length === 0) {
        alert("Votre panier est vide !");
        return;
    }

    const emailClient = prompt("Veuillez entrer votre adresse e-mail pour la commande :");
    if (!emailClient || !emailClient.includes("@")) {
        alert("E-mail invalide.");
        return;
    }

    try {
        const response = await fetch('http://localhost:4242/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ panier, emailClient }),
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la création de la session de paiement');
        }

        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error("URL de paiement manquante");
        }
    } catch (err) {
        console.error('Erreur paiement :', err);
        alert('Erreur lors de la création du paiement.');
    }
}

function validerPanier() {
    if (panier.length === 0) {
        alert("Votre panier est vide !");
        return;
    }
    passerAuPaiement();
}

function afficherPagePanier() {
    window.location.href = "panier.html";
}

document.addEventListener("DOMContentLoaded", () => {
    mettreAJourPanier();
    mettreAJourCompteur();
    afficherCommentaires();
});

// Commentaires
const MAX_CARACTERES = 100;

function ajouterCommentaire() {
    const nom = document.getElementById("nom").value.trim();
    const message = document.getElementById("message").value.trim();

    if (nom === "" || message === "") {
        alert("Veuillez remplir tous les champs.");
        return;
    }

    if (message.length > MAX_CARACTERES) {
        alert(`Votre commentaire est trop long ! Maximum ${MAX_CARACTERES} caractères.`);
        return;
    }

    const temoignages = JSON.parse(localStorage.getItem("temoignages")) || [];
    temoignages.push({ nom, message });
    localStorage.setItem("temoignages", JSON.stringify(temoignages));
    afficherCommentaires();
    document.getElementById("nom").value = "";
    document.getElementById("message").value = "";
}


