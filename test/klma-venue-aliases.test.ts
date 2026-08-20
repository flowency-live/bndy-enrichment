import { describe, expect, it } from 'vitest';
import {
  slugNormalise,
  canonicaliseVenue,
  lookupVenueCanonical,
  lookupTrustedBndyId,
  detectRegion,
  isSpecialistVenue,
  isMultiActVenue,
} from '../src/vertical-slice/klma-venue-aliases.js';

describe('KLMA venue aliases', () => {
  describe('slugNormalise', () => {
    it('lowercases and converts spaces to dashes', () => {
      expect(slugNormalise('The Nags Head')).toBe('the-nags-head');
    });

    it('strips apostrophes (straight and curly)', () => {
      expect(slugNormalise("Swifty's")).toBe('swiftys');
      expect(slugNormalise("Swifty\u2019s")).toBe('swiftys');
      expect(slugNormalise("Swifty\u2018s")).toBe('swiftys');
    });

    it('strips UK postcodes', () => {
      expect(slugNormalise('The Venue ST4 1AB')).toBe('the-venue');
      expect(slugNormalise('The Venue, Stoke ST4 1AB')).toBe('the-venue-stoke');
    });

    it('replaces punctuation with dashes', () => {
      expect(slugNormalise('Swiftys, Meir')).toBe('swiftys-meir');
      expect(slugNormalise('Swiftys. Meir')).toBe('swiftys-meir');
    });
  });

  describe('canonicaliseVenue', () => {
    it('trims whitespace', () => {
      expect(canonicaliseVenue('  The Venue  ')).toBe('The Venue');
    });

    it('normalises curly apostrophes to straight', () => {
      expect(canonicaliseVenue("Swifty\u2019s")).toBe("Swifty's");
    });

    it('strips embedded UK postcodes', () => {
      expect(canonicaliseVenue('The Venue ST4 1AB')).toBe('The Venue');
    });

    it('normalises " in Town" to ", Town"', () => {
      expect(canonicaliseVenue('The Nags Head in Macclesfield')).toBe('The Nags Head, Macclesfield');
    });
  });

  describe('lookupVenueCanonical', () => {
    it('returns canonical name for exact match', () => {
      expect(lookupVenueCanonical('Swiftys, Meir')).toBe('Swiftys, Meir');
    });

    it('returns canonical name for apostrophe variant', () => {
      expect(lookupVenueCanonical("Swifty's, Meir")).toBe('Swiftys, Meir');
    });

    it('returns canonical name for punctuation variant', () => {
      expect(lookupVenueCanonical('Swiftys. Meir')).toBe('Swiftys, Meir');
    });

    it('returns canonical name for variant without town', () => {
      expect(lookupVenueCanonical('Swiftys')).toBe('Swiftys, Meir');
    });

    it('returns null for unknown venue', () => {
      expect(lookupVenueCanonical('Unknown Random Venue')).toBeNull();
    });

    it('returns null for ambiguous venue requiring review', () => {
      expect(lookupVenueCanonical('Ashwood Longton')).toBeNull();
    });
  });

  describe('lookupTrustedBndyId', () => {
    it('returns bndyId for Swiftys, Meir (exact)', () => {
      expect(lookupTrustedBndyId('Swiftys, Meir')).toBe('aayxv4IGQbBmXBpk7WZL');
    });

    it('returns bndyId for Swifty\'s, Meir (apostrophe variant)', () => {
      expect(lookupTrustedBndyId("Swifty's, Meir")).toBe('aayxv4IGQbBmXBpk7WZL');
    });

    it('returns bndyId for Swiftys. Meir (punctuation variant)', () => {
      expect(lookupTrustedBndyId('Swiftys. Meir')).toBe('aayxv4IGQbBmXBpk7WZL');
    });

    it('returns bndyId for Swiftys without town', () => {
      expect(lookupTrustedBndyId('Swiftys')).toBe('aayxv4IGQbBmXBpk7WZL');
    });

    it('returns bndyId for The Swan, Stone', () => {
      expect(lookupTrustedBndyId('The Swan, Stone')).toBe('74BjwiHSxHDxdUghRVB9');
    });

    it('returns bndyId for The Moorland Inn, Burslem', () => {
      expect(lookupTrustedBndyId('The Moorland Inn, Burslem')).toBe('hbXt7haW5QcV06fHixD0');
    });

    it('returns bndyId for Moorland Inn Smallthorne (variant)', () => {
      expect(lookupTrustedBndyId('Moorland Inn Smallthorne')).toBe('hbXt7haW5QcV06fHixD0');
    });

    it('returns bndyId for The Roebuck, Forsbrook', () => {
      expect(lookupTrustedBndyId('The Roebuck, Forsbrook')).toBe('I7RcAfPu0g4DP7kXdlaL');
    });

    it('returns null for venue without trusted bndyId', () => {
      expect(lookupTrustedBndyId('The Nags Head, Macclesfield')).toBeNull();
    });

    it('returns null for Ashwood Longton (must not auto-resolve)', () => {
      expect(lookupTrustedBndyId('Ashwood Longton')).toBeNull();
    });

    it('returns null for unknown venue', () => {
      expect(lookupTrustedBndyId('Random Pub Somewhere')).toBeNull();
    });
  });

  describe('detectRegion', () => {
    it('detects Cheshire from Macclesfield', () => {
      const result = detectRegion('The Nags Head, Macclesfield');
      expect(result.region).toBe('Cheshire');
      expect(result.city).toBe('Macclesfield');
    });

    it('detects Cheshire from Crewe', () => {
      const result = detectRegion('Crewe Market Hall');
      expect(result.region).toBe('Cheshire');
      expect(result.city).toBe('Crewe');
    });

    it('detects Staffordshire from Meir', () => {
      const result = detectRegion('Swiftys, Meir');
      expect(result.region).toBe('Staffordshire');
      expect(result.city).toBe('Meir');
    });

    it('detects Staffordshire from Newcastle-under-Lyme', () => {
      const result = detectRegion('The Rigger, Newcastle-under-Lyme');
      expect(result.region).toBe('Staffordshire');
      expect(result.city).toBe('Newcastle-under-Lyme');
    });

    it('defaults to Staffordshire with empty city for unknown', () => {
      const result = detectRegion('Random Venue');
      expect(result.region).toBe('Staffordshire');
      expect(result.city).toBe('');
    });
  });

  describe('isSpecialistVenue', () => {
    it('identifies Artisan Tap as specialist', () => {
      expect(isSpecialistVenue('artisan-tap-hartshill')).toBe(true);
    });

    it('identifies Eleven as specialist', () => {
      expect(isSpecialistVenue('eleven-stoke')).toBe(true);
    });

    it('returns false for non-specialist venue', () => {
      expect(isSpecialistVenue('swiftys-meir')).toBe(false);
    });
  });

  describe('isMultiActVenue', () => {
    it('identifies The Rigger as multi-act', () => {
      expect(isMultiActVenue('the-rigger-newcastle-under-lyme')).toBe(true);
    });

    it('returns false for non-multi-act venue', () => {
      expect(isMultiActVenue('swiftys-meir')).toBe(false);
    });
  });
});
