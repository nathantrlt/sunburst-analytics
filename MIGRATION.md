# Migration Guide: Metric-Based Categories

## À exécuter sur Railway

Pour activer les nouvelles fonctionnalités de catégories basées sur des métriques, vous devez exécuter la migration sur Railway.

### Option 1: Via le CLI Railway

```bash
railway run npm run migrate
```

### Option 2: Via le shell Railway

```bash
# Ouvrir un shell sur Railway
railway shell

# Exécuter la migration
npm run migrate
```

### Option 3: Manuellement via MySQL

Si les options ci-dessus ne fonctionnent pas, vous pouvez exécuter directement les requêtes SQL :

```sql
-- Ajouter la colonne condition_period_days
ALTER TABLE page_categories
ADD COLUMN condition_period_days INT DEFAULT NULL
AFTER condition_value;

-- Mettre à jour l'ENUM condition_type
ALTER TABLE page_categories
MODIFY COLUMN condition_type ENUM(
  'contains', 'starts_with', 'ends_with', 'equals', 'regex',
  'pageviews_greater_than', 'pageviews_less_than',
  'avg_position_greater_than', 'avg_position_less_than',
  'avg_time_greater_than', 'avg_time_less_than'
) NOT NULL;
```

## Vérification

Après la migration, vous pouvez vérifier que tout fonctionne en créant une nouvelle catégorie avec un type basé sur des métriques.

## Nouveaux types de catégories disponibles

- **pageviews_greater_than** : Pages avec plus de X vues
- **pageviews_less_than** : Pages avec moins de X vues
- **avg_position_greater_than** : Pages avec une position moyenne > X
- **avg_position_less_than** : Pages avec une position moyenne < X
- **avg_time_greater_than** : Pages avec un temps moyen > X secondes
- **avg_time_less_than** : Pages avec un temps moyen < X secondes

## Paramètre optionnel

- **condition_period_days** : Période en jours pour calculer les métriques (null = toute la période)
