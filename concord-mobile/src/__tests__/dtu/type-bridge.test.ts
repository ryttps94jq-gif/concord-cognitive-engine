import {
  mobileToServerType,
  serverToMobileType,
  canSynthesize,
  SERVER_PRIMARY_TYPES,
  SERVER_DOMAIN_TYPES,
} from '../../dtu/type-bridge';
import { DTU_TYPES } from '../../utils/constants';

describe('DTU type bridge', () => {
  describe('mobileToServerType', () => {
    it('maps TEXT to CONDENSED', () => {
      expect(mobileToServerType(DTU_TYPES.TEXT)).toBe(SERVER_PRIMARY_TYPES.CONDENSED);
    });

    it('maps KNOWLEDGE to CONDENSED', () => {
      expect(mobileToServerType(DTU_TYPES.KNOWLEDGE)).toBe(SERVER_PRIMARY_TYPES.CONDENSED);
    });

    it('maps FOUNDATION_SENSE to SENSOR_READING', () => {
      expect(mobileToServerType(DTU_TYPES.FOUNDATION_SENSE)).toBe(SERVER_DOMAIN_TYPES.SENSOR_READING);
    });

    it('maps SHIELD_THREAT to SHIELD_THREAT', () => {
      expect(mobileToServerType(DTU_TYPES.SHIELD_THREAT)).toBe(SERVER_DOMAIN_TYPES.SHIELD_THREAT);
    });

    it('maps ECONOMY_TRANSACTION to ECONOMY_TRANSACTION', () => {
      expect(mobileToServerType(DTU_TYPES.ECONOMY_TRANSACTION)).toBe(SERVER_DOMAIN_TYPES.ECONOMY_TRANSACTION);
    });

    it('maps EMERGENCY_ALERT to EMERGENCY_ALERT', () => {
      expect(mobileToServerType(DTU_TYPES.EMERGENCY_ALERT)).toBe(SERVER_DOMAIN_TYPES.EMERGENCY_ALERT);
    });

    it('maps CREATIVE_WORK to MIXED', () => {
      expect(mobileToServerType(DTU_TYPES.CREATIVE_WORK)).toBe(SERVER_PRIMARY_TYPES.MIXED);
    });

    it('maps BROADCAST_RELAY to BROADCAST_RELAY', () => {
      expect(mobileToServerType(DTU_TYPES.BROADCAST_RELAY)).toBe(SERVER_DOMAIN_TYPES.BROADCAST_RELAY);
    });

    it('falls back to CONDENSED for unknown types', () => {
      expect(mobileToServerType(0xFF as never)).toBe(SERVER_PRIMARY_TYPES.CONDENSED);
    });

    it('maps all 14 mobile types', () => {
      const mobileTypes = Object.values(DTU_TYPES);
      for (const type of mobileTypes) {
        const serverType = mobileToServerType(type);
        expect(serverType).toBeGreaterThan(0);
      }
    });
  });

  describe('serverToMobileType', () => {
    it('maps PLAY_AUDIO to CREATIVE_WORK', () => {
      expect(serverToMobileType(SERVER_PRIMARY_TYPES.PLAY_AUDIO)).toBe(DTU_TYPES.CREATIVE_WORK);
    });

    it('maps DISPLAY_IMAGE to CREATIVE_WORK', () => {
      expect(serverToMobileType(SERVER_PRIMARY_TYPES.DISPLAY_IMAGE)).toBe(DTU_TYPES.CREATIVE_WORK);
    });

    it('maps RENDER_DOCUMENT to TEXT', () => {
      expect(serverToMobileType(SERVER_PRIMARY_TYPES.RENDER_DOCUMENT)).toBe(DTU_TYPES.TEXT);
    });

    it('maps SENSOR_READING to FOUNDATION_SENSE', () => {
      expect(serverToMobileType(SERVER_DOMAIN_TYPES.SENSOR_READING)).toBe(DTU_TYPES.FOUNDATION_SENSE);
    });

    it('maps ECONOMY_TRANSACTION to ECONOMY_TRANSACTION', () => {
      expect(serverToMobileType(SERVER_DOMAIN_TYPES.ECONOMY_TRANSACTION)).toBe(DTU_TYPES.ECONOMY_TRANSACTION);
    });

    it('falls back to TEXT for unknown types', () => {
      expect(serverToMobileType(0xFF)).toBe(DTU_TYPES.TEXT);
    });

    it('round-trips domain types', () => {
      const domainTypes = [
        DTU_TYPES.FOUNDATION_SENSE,
        DTU_TYPES.SHIELD_THREAT,
        DTU_TYPES.ECONOMY_TRANSACTION,
        DTU_TYPES.IDENTITY_ASSERTION,
        DTU_TYPES.MESH_CONTROL,
        DTU_TYPES.EMERGENCY_ALERT,
        DTU_TYPES.BROADCAST_RELAY,
        DTU_TYPES.ATLAS_SIGNAL,
        DTU_TYPES.LINEAGE_REF,
      ];
      for (const mobileType of domainTypes) {
        const serverType = mobileToServerType(mobileType);
        const backToMobile = serverToMobileType(serverType);
        expect(backToMobile).toBe(mobileType);
      }
    });
  });

  describe('canSynthesize', () => {
    it('detects sensor + knowledge as empirical_validation', () => {
      expect(canSynthesize(DTU_TYPES.FOUNDATION_SENSE, DTU_TYPES.KNOWLEDGE))
        .toBe('empirical_validation');
    });

    it('is symmetric', () => {
      expect(canSynthesize(DTU_TYPES.KNOWLEDGE, DTU_TYPES.FOUNDATION_SENSE))
        .toBe('empirical_validation');
    });

    it('detects threat + mesh control as threat_response', () => {
      expect(canSynthesize(DTU_TYPES.SHIELD_THREAT, DTU_TYPES.MESH_CONTROL))
        .toBe('threat_response');
    });

    it('detects transaction + knowledge as economic_insight', () => {
      expect(canSynthesize(DTU_TYPES.ECONOMY_TRANSACTION, DTU_TYPES.KNOWLEDGE))
        .toBe('economic_insight');
    });

    it('returns null for incompatible types', () => {
      expect(canSynthesize(DTU_TYPES.TEXT, DTU_TYPES.TEXT)).toBeNull();
      expect(canSynthesize(DTU_TYPES.MESH_CONTROL, DTU_TYPES.ECONOMY_TRANSACTION)).toBeNull();
    });
  });
});
