REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA private_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO camms_app, camms_auth;
GRANT USAGE ON SCHEMA private_auth TO camms_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA private_auth TO camms_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO camms_auth;
GRANT SELECT ON public.profiles TO camms_app;
GRANT UPDATE (full_name,sidebar_order) ON public.profiles TO camms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items,public.categories,public.locations,public.units TO camms_app;
GRANT SELECT, INSERT ON public.audit_logs TO camms_app;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO camms_app,camms_auth;
CREATE FUNCTION private.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.user_id',true),'')::uuid
$$;
CREATE FUNCTION private.current_app_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT role FROM public.profiles WHERE id=private.current_user_id() AND is_active=true
$$;
REVOKE ALL ON FUNCTION private.current_app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_app_role(), private.current_user_id() TO camms_app,camms_auth;
--> statement-breakpoint
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_auth ON public.profiles TO camms_auth USING (true) WITH CHECK (true);
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO camms_app USING (id=private.current_user_id() AND private.current_app_role() IS NOT NULL) WITH CHECK (id=private.current_user_id() AND private.current_app_role() IS NOT NULL);
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_read ON public.items FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY items_write ON public.items FOR ALL TO camms_app USING (private.current_app_role() IN ('admin','staff')) WITH CHECK (private.current_app_role() IN ('admin','staff'));
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_read ON public.categories FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY categories_insert ON public.categories FOR INSERT TO camms_app WITH CHECK (private.current_app_role() IN ('admin','staff'));
CREATE POLICY categories_update ON public.categories FOR UPDATE TO camms_app USING (private.current_app_role() IN ('admin','staff')) WITH CHECK (private.current_app_role() IN ('admin','staff'));
CREATE POLICY categories_delete ON public.categories FOR DELETE TO camms_app USING (private.current_app_role()='admin');
CREATE POLICY locations_read ON public.locations FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY locations_insert ON public.locations FOR INSERT TO camms_app WITH CHECK (private.current_app_role() IN ('admin','staff'));
CREATE POLICY locations_update ON public.locations FOR UPDATE TO camms_app USING (private.current_app_role() IN ('admin','staff')) WITH CHECK (private.current_app_role() IN ('admin','staff'));
CREATE POLICY locations_delete ON public.locations FOR DELETE TO camms_app USING (private.current_app_role()='admin');
CREATE POLICY units_read ON public.units FOR SELECT TO camms_app USING (private.current_app_role() IS NOT NULL);
CREATE POLICY units_insert ON public.units FOR INSERT TO camms_app WITH CHECK (private.current_app_role() IN ('admin','staff'));
CREATE POLICY units_update ON public.units FOR UPDATE TO camms_app USING (private.current_app_role() IN ('admin','staff')) WITH CHECK (private.current_app_role() IN ('admin','staff'));
CREATE POLICY units_delete ON public.units FOR DELETE TO camms_app USING (private.current_app_role()='admin');
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO camms_app USING (private.current_app_role()='admin' OR (target_table='items' AND private.current_app_role() IS NOT NULL));
CREATE POLICY audit_append ON public.audit_logs FOR INSERT TO camms_app WITH CHECK (user_id=private.current_user_id() AND private.current_app_role() IS NOT NULL);
--> statement-breakpoint
CREATE FUNCTION private.stamp_update() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$;
CREATE FUNCTION private.audit_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := private.current_user_id();
BEGIN
 INSERT INTO public.audit_logs(user_id,action,target_table,target_id,old_data,new_data)
 VALUES(actor, lower(TG_OP),TG_TABLE_NAME,coalesce(NEW.id,OLD.id),CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 PERFORM pg_notify('camms_changes',TG_TABLE_NAME);
 RETURN coalesce(NEW,OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.audit_change(),private.stamp_update() FROM PUBLIC;
CREATE TRIGGER profiles_stamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.stamp_update();
CREATE TRIGGER items_stamp BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION private.stamp_update();
CREATE TRIGGER categories_stamp BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION private.stamp_update();
CREATE TRIGGER locations_stamp BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION private.stamp_update();
CREATE TRIGGER units_stamp BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION private.stamp_update();
CREATE TRIGGER profiles_audit AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE TRIGGER items_audit AFTER INSERT OR UPDATE OR DELETE ON public.items FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE TRIGGER categories_audit AFTER INSERT OR UPDATE OR DELETE ON public.categories FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE TRIGGER locations_audit AFTER INSERT OR UPDATE OR DELETE ON public.locations FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE TRIGGER units_audit AFTER INSERT OR UPDATE OR DELETE ON public.units FOR EACH ROW EXECUTE FUNCTION private.audit_change();
--> statement-breakpoint
CREATE FUNCTION private_auth.record_admin_event(actor uuid,target uuid,event_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF actor IS DISTINCT FROM private.current_user_id() OR private.current_app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.audit_logs(user_id,action,target_table,target_id) VALUES(actor,event_action,'profiles',target);
END;
$$;
REVOKE ALL ON FUNCTION private_auth.record_admin_event(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private_auth.record_admin_event(uuid,uuid,text) TO camms_auth;
