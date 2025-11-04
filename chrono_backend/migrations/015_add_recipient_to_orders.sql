-- Migration pour ajouter les colonnes recipient et package_images à la table orders
-- Ces colonnes permettent de stocker les informations du destinataire et les photos du colis

-- Ajouter la colonne recipient (JSONB) pour stocker les informations du destinataire
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'recipient'
  ) THEN
    ALTER TABLE orders 
    ADD COLUMN recipient JSONB;
    
    COMMENT ON COLUMN orders.recipient IS 'Informations du destinataire (téléphone, nom, etc.) stockées en JSON';
  END IF;
END $$;

-- Ajouter la colonne package_images (TEXT[]) pour stocker les URLs/URIs des images du colis
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'package_images'
  ) THEN
    ALTER TABLE orders 
    ADD COLUMN package_images TEXT[];
    
    COMMENT ON COLUMN orders.package_images IS 'Liste des URLs/URIs des images du colis';
  END IF;
END $$;

-- Mettre à jour les commentaires pour pickup_address et dropoff_address pour indiquer qu'ils peuvent contenir des détails
-- Vérifier d'abord si les colonnes existent avant de mettre à jour les commentaires
DO $$ 
BEGIN
  -- Mettre à jour le commentaire pour pickup_address si la colonne existe
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'pickup_address'
  ) THEN
    COMMENT ON COLUMN orders.pickup_address IS 'Coordonnées, adresse et détails de prise en charge (entrance, apartment, floor, intercom, photos) stockés en JSON';
  END IF;

  -- Mettre à jour le commentaire pour dropoff_address si la colonne existe
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'dropoff_address'
  ) THEN
    COMMENT ON COLUMN orders.dropoff_address IS 'Coordonnées, adresse et détails de livraison (entrance, apartment, floor, intercom, phone) stockés en JSON';
  END IF;

  -- Si les colonnes s'appellent pickup et dropoff (sans _address), mettre à jour aussi
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'pickup'
  ) THEN
    COMMENT ON COLUMN orders.pickup IS 'Coordonnées, adresse et détails de prise en charge (entrance, apartment, floor, intercom, photos) stockés en JSON';
  END IF;

  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'dropoff'
  ) THEN
    COMMENT ON COLUMN orders.dropoff IS 'Coordonnées, adresse et détails de livraison (entrance, apartment, floor, intercom, phone) stockés en JSON';
  END IF;
END $$;

