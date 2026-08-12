# Geosom CRM (React + Node.js + MongoDB)

CRM complet pour Geosom Technologies Solutions.

## Stack

- Frontend: React (Vite + TypeScript)
- Backend: Node.js (Express)
- Base de donnees: MongoDB (Mongoose)

## Modules inclus

- Tableau de bord (indicateurs CA, clients, top clients)
- Gestion des clients (creation + liste)
- Gestion des suivis (creation + liste)
- Rapports (statistiques et classement CA)
- Parametres entreprise

## Installation

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API disponible sur `http://localhost:5000`.

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Application disponible sur `http://localhost:5173`.

## Notes

- Les donnees d'exemple Geosom sont injectees automatiquement au premier demarrage backend.
- Assurez-vous que MongoDB tourne localement sur `mongodb://localhost:27017/CRM`.
