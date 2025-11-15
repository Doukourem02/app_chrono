# 📦 Guide de Backup & Recovery

Ce document décrit les procédures de backup et de récupération pour Chrono Backend.

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Backup](#backup)
3. [Recovery](#recovery)
4. [Procédures testées](#procédures-testées)
5. [Automatisation](#automatisation)
6. [Dépannage](#dépannage)

---

## 🎯 Vue d'ensemble

Le système de backup/recovery permet de:
- **Backup**: Sauvegarder automatiquement les bases de données PostgreSQL et Supabase
- **Recovery**: Restaurer les données depuis un backup en cas de perte
- **Vérification**: Tester l'intégrité des backups
- **Rotation**: Garder automatiquement les N derniers backups

### Fichiers de backup

Les backups sont stockés dans le répertoire `backups/` à la racine du projet.

Format des noms:
- `postgres_backup_YYYY-MM-DD_HH-MM-SS.sql.gz` (PostgreSQL)
- `supabase_backup_YYYY-MM-DD_HH-MM-SS.sql.gz` (Supabase)

---

## 💾 Backup

### Commandes disponibles

```bash
# Backup PostgreSQL uniquement
npm run backup:postgres

# Backup Supabase uniquement
npm run backup:supabase

# Backup des deux bases de données
npm run backup:all

# Tester un backup (vérifier l'intégrité)
npm run backup:test
```

### Configuration

Variables d'environnement (optionnelles):

```bash
# Répertoire de stockage des backups (défaut: ./backups)
BACKUP_DIR=/path/to/backups

# Nombre maximum de backups à garder (défaut: 30)
MAX_BACKUPS=30

# Activer/désactiver la compression (défaut: true)
COMPRESS_BACKUPS=true

# URL de la base de données PostgreSQL
DATABASE_URL=postgresql://user:password@host:port/database

# URL de la base de données Supabase (optionnel)
SUPABASE_DB_URL=postgresql://user:password@host:port/database
```

### Fonctionnalités

✅ **Compression automatique** - Les backups sont compressés avec gzip  
✅ **Rotation automatique** - Les anciens backups sont supprimés automatiquement  
✅ **Vérification d'intégrité** - Chaque backup est vérifié après création  
✅ **Métadonnées** - Les informations de backup sont sauvegardées dans `backup_metadata.json`  
✅ **Logging détaillé** - Toutes les opérations sont loggées

### Exemple de sortie

```
🚀 Démarrage du processus de backup...
📁 Répertoire de backup: /path/to/backups
📦 Compression: Activée
🗑️  Rétention: 30 backups maximum

🔄 Démarrage du backup PostgreSQL...
✅ Backup PostgreSQL créé: postgres_backup_2024-01-15_10-30-00.sql (5242880 bytes)
📦 Backup compressé: 1.25 MB
✅ Backup compressé valide: postgres_backup_2024-01-15_10-30-00.sql.gz
🧹 Suppression de 1 ancien(s) backup(s)...
  ✓ Supprimé: postgres_backup_2024-01-10_10-30-00.sql.gz

📊 Résumé des backups:
✅ 1 backup(s) réussi(s):
   - postgres: postgres_backup_2024-01-15_10-30-00.sql.gz (1.25 MB)

✅ Tous les backups ont été créés avec succès!
```

---

## 🔄 Recovery

### Commandes disponibles

```bash
# Lister tous les backups disponibles
npm run recovery:list

# Tester un backup (vérifier qu'il est valide)
npm run recovery:test <backup_file>

# Restaurer un backup (avec confirmation)
npm run recovery:restore <backup_file>

# Tester la restauration sans l'exécuter (dry-run)
npm run recovery:restore <backup_file> --dry-run
```

### Procédure de restauration

1. **Lister les backups disponibles:**
   ```bash
   npm run recovery:list
   ```

2. **Tester le backup avant restauration:**
   ```bash
   npm run recovery:test postgres_backup_2024-01-15_10-30-00.sql.gz
   ```

3. **Restaurer le backup:**
   ```bash
   npm run recovery:restore postgres_backup_2024-01-15_10-30-00.sql.gz
   ```

### Sécurité

⚠️ **IMPORTANT**: La restauration va **écraser** la base de données actuelle!

Le script:
- ✅ Crée automatiquement un backup de sécurité avant la restauration
- ✅ Demande confirmation avant d'exécuter
- ✅ Vérifie l'intégrité du backup avant restauration
- ✅ Supporte le mode dry-run pour tester sans risque

---

## ✅ Procédures Testées

### Test 1: Backup PostgreSQL

**Objectif**: Vérifier que le backup PostgreSQL fonctionne correctement

**Procédure**:
```bash
# 1. Créer un backup
npm run backup:postgres

# 2. Vérifier que le fichier existe
ls -lh backups/postgres_backup_*.sql.gz

# 3. Tester l'intégrité
npm run recovery:test backups/postgres_backup_*.sql.gz
```

**Résultat attendu**: ✅ Backup créé, compressé et validé

---

### Test 2: Restauration (Dry-Run)

**Objectif**: Tester la procédure de restauration sans risque

**Procédure**:
```bash
# 1. Lister les backups
npm run recovery:list

# 2. Tester la restauration en mode dry-run
npm run recovery:restore backups/postgres_backup_2024-01-15_10-30-00.sql.gz --dry-run
```

**Résultat attendu**: ✅ Le backup est validé, aucune modification n'est effectuée

---

### Test 3: Restauration Complète

**Objectif**: Vérifier que la restauration fonctionne en conditions réelles

**Procédure**:
```bash
# 1. Créer un backup de test
npm run backup:postgres

# 2. Noter le nom du backup créé
BACKUP_FILE=$(ls -t backups/postgres_backup_*.sql.gz | head -1)

# 3. Créer une table de test dans la base
psql $DATABASE_URL -c "CREATE TABLE test_backup (id SERIAL PRIMARY KEY, data TEXT);"
psql $DATABASE_URL -c "INSERT INTO test_backup (data) VALUES ('avant backup');"

# 4. Créer un nouveau backup
npm run backup:postgres

# 5. Modifier la table
psql $DATABASE_URL -c "INSERT INTO test_backup (data) VALUES ('après backup');"

# 6. Restaurer le backup précédent
npm run recovery:restore $BACKUP_FILE

# 7. Vérifier que la table a été restaurée
psql $DATABASE_URL -c "SELECT * FROM test_backup;"
```

**Résultat attendu**: ✅ La table contient seulement "avant backup", la restauration a fonctionné

---

### Test 4: Rotation des Backups

**Objectif**: Vérifier que les anciens backups sont supprimés automatiquement

**Procédure**:
```bash
# 1. Configurer MAX_BACKUPS=3
export MAX_BACKUPS=3

# 2. Créer 5 backups
for i in {1..5}; do
  npm run backup:postgres
  sleep 1
done

# 3. Vérifier qu'il n'y a que 3 backups
ls backups/postgres_backup_*.sql.gz | wc -l
```

**Résultat attendu**: ✅ Seulement 3 backups sont conservés

---

## 🤖 Automatisation

### Cron Job (Linux/Mac)

Pour automatiser les backups quotidiens:

```bash
# Éditer le crontab
crontab -e

# Ajouter cette ligne pour un backup quotidien à 2h du matin
0 2 * * * cd /path/to/chrono_backend && npm run backup:all >> /var/log/chrono-backup.log 2>&1
```

### Systemd Timer (Linux)

Créer `/etc/systemd/system/chrono-backup.service`:

```ini
[Unit]
Description=Chrono Backend Backup
After=network.target

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/path/to/chrono_backend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run backup:all
```

Créer `/etc/systemd/system/chrono-backup.timer`:

```ini
[Unit]
Description=Run Chrono Backup Daily
Requires=chrono-backup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Activer le timer:
```bash
sudo systemctl enable chrono-backup.timer
sudo systemctl start chrono-backup.timer
```

### GitHub Actions (CI/CD)

Créer `.github/workflows/backup.yml`:

```yaml
name: Daily Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Tous les jours à 2h UTC
  workflow_dispatch:  # Permet de déclencher manuellement

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        working-directory: chrono_backend
      
      - name: Run backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: npm run backup:all
        working-directory: chrono_backend
      
      - name: Upload backups
        uses: actions/upload-artifact@v3
        with:
          name: backups
          path: chrono_backend/backups/*
          retention-days: 30
```

---

## 🔧 Dépannage

### Erreur: "pg_dump: command not found"

**Solution**: Installer PostgreSQL client tools

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Vérifier l'installation
which pg_dump
```

### Erreur: "Permission denied"

**Solution**: Vérifier les permissions du répertoire de backup

```bash
chmod 755 backups/
chown your-user:your-group backups/
```

### Erreur: "Backup file is empty"

**Causes possibles**:
- La base de données est vide
- Problème de connexion à la base de données
- Permissions insuffisantes

**Solution**: Vérifier la connexion et les permissions

```bash
# Tester la connexion
psql $DATABASE_URL -c "SELECT version();"
```

### Erreur: "Backup compressed file is corrupted"

**Solution**: Le fichier peut être corrompu, essayer de le décompresser manuellement

```bash
gunzip -t backup_file.sql.gz
```

Si cela échoue, le backup est corrompu et ne peut pas être restauré.

---

## 📊 Monitoring

### Vérifier les métadonnées des backups

```bash
cat backups/backup_metadata.json | jq '.'
```

### Vérifier l'espace disque utilisé

```bash
du -sh backups/
```

### Lister les backups par taille

```bash
ls -lhS backups/*.sql.gz
```

---

## 🔐 Sécurité

### Stockage des backups

⚠️ **IMPORTANT**: Les backups contiennent des données sensibles!

- ✅ Ne jamais commiter les backups dans Git
- ✅ Chiffrer les backups si stockés sur un service cloud
- ✅ Limiter l'accès au répertoire de backup
- ✅ Utiliser des permissions restrictives (600)

### Chiffrement des backups

Pour chiffrer les backups avant stockage:

```bash
# Chiffrer
gpg --symmetric --cipher-algo AES256 backup_file.sql.gz

# Déchiffrer
gpg --decrypt backup_file.sql.gz.gpg > backup_file.sql.gz
```

---

## 📝 Checklist de Production

Avant de mettre en production, vérifier:

- [ ] Les backups sont configurés et testés
- [ ] La rotation automatique fonctionne
- [ ] Les backups sont stockés dans un endroit sûr (hors serveur)
- [ ] La procédure de restauration a été testée
- [ ] Un cron job ou timer est configuré pour les backups automatiques
- [ ] Les métadonnées de backup sont surveillées
- [ ] Un plan de récupération en cas de sinistre est documenté

---

## 📞 Support

En cas de problème:
1. Vérifier les logs dans la console
2. Consulter la section [Dépannage](#dépannage)
3. Vérifier les métadonnées de backup
4. Tester avec un backup récent

---

**Dernière mise à jour**: 2024-01-15

