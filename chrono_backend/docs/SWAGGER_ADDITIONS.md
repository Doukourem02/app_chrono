# Documentation Swagger - Routes Admin et Analytics

Ce document contient la documentation Swagger à ajouter pour les routes admin et analytics.

## Routes Admin (`/api/admin/*`)

### GET /api/admin/dashboard-stats

**Description:** Récupère les statistiques du dashboard admin.

**Authentification:** Requis (Bearer Token - Admin)

**Query Parameters:**
- `startDate` (string, optional): Date de début (format ISO)
- `endDate` (string, optional): Date de fin (format ISO)

**Réponse 200:**
```json
{
  "success": true,
  "data": {
    "onDelivery": 10,
    "onDeliveryChange": 5,
    "successDeliveries": 150,
    "successDeliveriesChange": 20,
    "revenue": 500000,
    "revenueChange": 50000
  }
}
```

---

### GET /api/admin/delivery-analytics

**Description:** Récupère les analytics de livraison.

**Authentification:** Requis (Bearer Token - Admin)

**Query Parameters:**
- `startDate` (string, optional): Date de début
- `endDate` (string, optional): Date de fin

**Réponse 200:**
```json
{
  "success": true,
  "data": {
    "totalDeliveries": 1000,
    "completedDeliveries": 950,
    "cancelledDeliveries": 50,
    "averageDeliveryTime": "45 min",
    "averageDistance": 8.5
  }
}
```

---

### GET /api/admin/drivers

**Description:** Liste tous les chauffeurs.

**Authentification:** Requis (Bearer Token - Admin)

**Query Parameters:**
- `page` (number, optional): Numéro de page (défaut: 1)
- `limit` (number, optional): Nombre d'éléments par page (défaut: 20)
- `status` (string, optional): Filtrer par statut ('active', 'inactive', 'suspended')

**Réponse 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "driver-123",
      "email": "driver@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "phone": "+221771234567",
      "status": "active",
      "rating": 4.5,
      "totalDeliveries": 150
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### GET /api/admin/drivers/:driverId

**Description:** Récupère les détails complets d'un chauffeur.

**Authentification:** Requis (Bearer Token - Admin)

**Paramètres:**
- `driverId` (string, path): ID du chauffeur

**Réponse 200:**
```json
{
  "success": true,
  "data": {
    "id": "driver-123",
    "email": "driver@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+221771234567",
    "status": "active",
    "rating": 4.5,
    "totalDeliveries": 150,
    "commissionRate": 0.15,
    "balance": 50000,
    "recentOrders": []
  }
}
```

---

### PUT /api/admin/drivers/:driverId/status

**Description:** Met à jour le statut d'un chauffeur.

**Authentification:** Requis (Bearer Token - Admin)

**Paramètres:**
- `driverId` (string, path): ID du chauffeur

**Body:**
```json
{
  "status": "active" | "inactive" | "suspended"
}
```

**Réponse 200:**
```json
{
  "success": true,
  "message": "Statut mis à jour",
  "data": {
    "id": "driver-123",
    "status": "active"
  }
}
```

---

### GET /api/admin/financial-stats

**Description:** Récupère les statistiques financières.

**Authentification:** Requis (Bearer Token - Admin)

**Query Parameters:**
- `startDate` (string, optional): Date de début
- `endDate` (string, optional): Date de fin

**Réponse 200:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 1000000,
    "totalCommissions": 150000,
    "totalRefunds": 5000,
    "netRevenue": 845000
  }
}
```

---

### GET /api/admin/transactions

**Description:** Liste toutes les transactions.

**Authentification:** Requis (Bearer Token - Admin)

**Query Parameters:**
- `page` (number, optional): Numéro de page
- `limit` (number, optional): Nombre d'éléments par page
- `status` (string, optional): Filtrer par statut
- `paymentMethod` (string, optional): Filtrer par méthode de paiement

**Réponse 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "txn-123",
      "orderId": "order-456",
      "amount": 5000,
      "status": "paid",
      "paymentMethodType": "orange_money",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

### GET /api/admin/reports/deliveries

**Description:** Génère un rapport des livraisons.

**Authentification:** Requis (Bearer Token - Admin)

**Query Parameters:**
- `startDate` (string, optional): Date de début
- `endDate` (string, optional): Date de fin
- `format` (string, optional): Format d'export ('json' | 'csv')

**Réponse 200:**
```json
{
  "success": true,
  "data": {
    "totalDeliveries": 1000,
    "completed": 950,
    "cancelled": 50,
    "byStatus": {
      "completed": 950,
      "cancelled": 50
    },
    "byMethod": {
      "moto": 600,
      "vehicule": 300,
      "cargo": 100
    }
  }
}
```

---

## Routes Analytics (`/api/analytics/*`)

### GET /api/analytics/kpis

**Description:** Récupère les KPIs en temps réel.

**Authentification:** Requis (Bearer Token - Admin)

**Réponse 200:**
```json
{
  "success": true,
  "data": {
    "today": {
      "orders": 50,
      "revenue": 250000,
      "averageDeliveryTime": "35 min"
    },
    "week": {
      "orders": 350,
      "revenue": 1750000,
      "averageDeliveryTime": "40 min"
    },
    "month": {
      "orders": 1500,
      "revenue": 7500000,
      "averageDeliveryTime": "42 min"
    }
  }
}
```

---

### GET /api/analytics/performance

**Description:** Récupère les données de performance.

**Authentification:** Requis (Bearer Token - Admin)

**Query Parameters:**
- `startDate` (string, optional): Date de début
- `endDate` (string, optional): Date de fin
- `metric` (string, optional): Métrique spécifique ('delivery_time', 'success_rate', 'revenue')

**Réponse 200:**
```json
{
  "success": true,
  "data": {
    "deliveryTime": {
      "average": "40 min",
      "min": "15 min",
      "max": "120 min"
    },
    "successRate": 0.95,
    "revenue": {
      "total": 1000000,
      "trend": "up"
    }
  }
}
```

---

### GET /api/analytics/export

**Description:** Exporte les données analytics.

**Authentification:** Requis (Bearer Token - Admin)

**Query Parameters:**
- `startDate` (string, optional): Date de début
- `endDate` (string, optional): Date de fin
- `format` (string, required): Format d'export ('json' | 'csv' | 'xlsx')

**Réponse 200:**
Fichier téléchargeable selon le format demandé.

---

## Routes Commission (`/api/admin/drivers/:driverId/commission/*`)

### GET /api/admin/drivers/:driverId/commission/transactions

**Description:** Récupère les transactions de commission d'un chauffeur.

**Authentification:** Requis (Bearer Token - Admin)

**Paramètres:**
- `driverId` (string, path): ID du chauffeur

**Query Parameters:**
- `page` (number, optional): Numéro de page
- `limit` (number, optional): Nombre d'éléments par page

**Réponse 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "commission-123",
      "orderId": "order-456",
      "amount": 750,
      "type": "deduction",
      "balance": 50000,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### POST /api/admin/drivers/:driverId/commission/recharge

**Description:** Recharge le solde de commission d'un chauffeur.

**Authentification:** Requis (Bearer Token - Admin)

**Paramètres:**
- `driverId` (string, path): ID du chauffeur

**Body:**
```json
{
  "amount": 10000,
  "reason": "Recharge manuelle"
}
```

**Réponse 200:**
```json
{
  "success": true,
  "message": "Solde rechargé",
  "data": {
    "driverId": "driver-123",
    "newBalance": 60000,
    "amountAdded": 10000
  }
}
```

---

### PUT /api/admin/drivers/:driverId/commission/rate

**Description:** Met à jour le taux de commission d'un chauffeur.

**Authentification:** Requis (Bearer Token - Admin)

**Paramètres:**
- `driverId` (string, path): ID du chauffeur

**Body:**
```json
{
  "commissionRate": 0.15
}
```

**Réponse 200:**
```json
{
  "success": true,
  "message": "Taux de commission mis à jour",
  "data": {
    "driverId": "driver-123",
    "commissionRate": 0.15
  }
}
```

---

### PUT /api/admin/drivers/:driverId/commission/suspend

**Description:** Suspend le prélèvement de commission pour un chauffeur.

**Authentification:** Requis (Bearer Token - Admin)

**Paramètres:**
- `driverId` (string, path): ID du chauffeur

**Body:**
```json
{
  "suspended": true,
  "reason": "Raison de la suspension"
}
```

**Réponse 200:**
```json
{
  "success": true,
  "message": "Prélèvement de commission suspendu",
  "data": {
    "driverId": "driver-123",
    "suspended": true
  }
}
```

---

## Notes

1. Toutes les routes admin nécessitent une authentification via `verifyAdminSupabase`.
2. Les dates doivent être au format ISO 8601.
3. Toutes les réponses suivent le format standard avec `success: boolean` et `data: object`.
4. Les erreurs suivent le format standard avec `success: false` et `message: string`.

