-- Script de nettoyage complet d'un utilisateur
-- Utilisation: Remplacer 'USER_EMAIL' par l'email de l'utilisateur à nettoyer
-- Ce script supprime toutes les traces d'un utilisateur dans PostgreSQL
-- ATTENTION: Ce script supprime définitivement les données. Utiliser avec précaution.

-- 1. Trouver l'ID de l'utilisateur
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'USER_EMAIL'; -- ⚠️ REMPLACER PAR L'EMAIL
BEGIN
    -- Récupérer l'ID de l'utilisateur
    SELECT id INTO v_user_id
    FROM public.users
    WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Utilisateur non trouvé avec l''email: %', v_email;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Nettoyage des données pour l''utilisateur: % (ID: %)', v_email, v_user_id;
    
    -- 2. Supprimer le profil driver (si existe)
    DELETE FROM public.driver_profiles
    WHERE user_id = v_user_id;
    
    IF FOUND THEN
        RAISE NOTICE 'Profil driver supprimé';
    ELSE
        RAISE NOTICE 'Aucun profil driver trouvé';
    END IF;
    
    -- 3. Supprimer les commandes associées (optionnel - décommenter si nécessaire)
    -- DELETE FROM public.orders WHERE driver_id = v_user_id OR client_id = v_user_id;
    
    -- 4. Supprimer les méthodes de paiement (si existe)
    DELETE FROM public.payment_methods
    WHERE user_id = v_user_id;
    
    IF FOUND THEN
        RAISE NOTICE 'Méthodes de paiement supprimées';
    END IF;
    
    -- 5. Supprimer l'utilisateur de la table users
    DELETE FROM public.users
    WHERE id = v_user_id;
    
    IF FOUND THEN
        RAISE NOTICE 'Utilisateur supprimé de PostgreSQL avec succès';
    END IF;
    
    RAISE NOTICE 'Nettoyage terminé pour: %', v_email;
END $$;

-- Alternative: Fonction réutilisable pour nettoyer un utilisateur par email
CREATE OR REPLACE FUNCTION cleanup_user_by_email(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID;
    v_result TEXT := '';
BEGIN
    -- Récupérer l'ID de l'utilisateur
    SELECT id INTO v_user_id
    FROM public.users
    WHERE email = p_email;
    
    IF v_user_id IS NULL THEN
        RETURN 'Utilisateur non trouvé avec l''email: ' || p_email;
    END IF;
    
    -- Supprimer le profil driver
    DELETE FROM public.driver_profiles
    WHERE user_id = v_user_id;
    
    IF FOUND THEN
        v_result := v_result || 'Profil driver supprimé. ';
    END IF;
    
    -- Supprimer les méthodes de paiement
    DELETE FROM public.payment_methods
    WHERE user_id = v_user_id;
    
    IF FOUND THEN
        v_result := v_result || 'Méthodes de paiement supprimées. ';
    END IF;
    
    -- Supprimer l'utilisateur
    DELETE FROM public.users
    WHERE id = v_user_id;
    
    IF FOUND THEN
        v_result := v_result || 'Utilisateur supprimé de PostgreSQL. ';
    END IF;
    
    RETURN 'Nettoyage terminé pour: ' || p_email || '. ' || v_result;
END;
$$ LANGUAGE plpgsql;

-- Utilisation de la fonction:
-- SELECT cleanup_user_by_email('user@example.com');

