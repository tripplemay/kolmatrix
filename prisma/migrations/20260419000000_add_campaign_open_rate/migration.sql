-- Migration: 20260419_add_campaign_open_rate
-- Purpose: F007 Dashboard KPI 卡需要 Campaign.openRate 字段支持。
-- ROLLBACK: ALTER TABLE campaign DROP COLUMN open_rate;

ALTER TABLE "campaign" ADD COLUMN "open_rate" DECIMAL(5, 4);
