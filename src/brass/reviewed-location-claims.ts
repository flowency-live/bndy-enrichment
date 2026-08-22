import type { BrassBandProjectionPackage } from './projection.js';

export interface ReviewedBandLocationClaim {
  bandName: string;
  town: string;
  county?: string;
  postcode: string;
  evidenceUrl: string;
  note: string;
}

function key(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Human-reviewed location evidence for the first canonical rollout.
 *
 * These claims exist specifically because a postal/contact address discovered
 * on a website is not necessarily the Band's home/rehearsal location. Every
 * override must name the public evidence that establishes the Band's base.
 */
export const REVIEWED_BAND_LOCATION_CLAIMS: ReviewedBandLocationClaim[] = [
  {
    bandName: 'Black Dyke Band',
    town: 'Queensbury, Bradford',
    county: 'West Yorkshire',
    postcode: 'BD13 1AB',
    evidenceUrl: 'https://www.blackdykeband.co.uk/',
    note: 'Official Band site gives Black Dyke Band, Sandbeds, Queensbury, Bradford, West Yorkshire, BD13 1AB.',
  },
  {
    bandName: 'City of Oxford Silver Band',
    town: 'Oxford',
    county: 'Oxfordshire',
    postcode: 'OX4 2FA',
    evidenceUrl: 'https://www.cosb.co.uk/about/',
    note: 'Official Band site states rehearsals are at the Silver Band Hall, Temple Cowley, Oxford, OX4 2FA.',
  },
  {
    bandName: 'Granite City Brass',
    town: 'Aberdeen',
    postcode: 'AB10 7DR',
    evidenceUrl: 'https://www.aliss.org/services/ed3cd498-7e37-48e3-a8b5-35a90acfb197',
    note: 'Claimed organisation listing identifies Granite City Brass at Inchgarth Community Centre, Aberdeen, AB10 7DR.',
  },
  {
    bandName: 'Irvine & Dreghorn Community Brass',
    town: 'Dreghorn',
    county: 'North Ayrshire',
    postcode: 'KA11 4AQ',
    evidenceUrl: 'https://www.idbrass.com/about-us',
    note: 'Official Band site states it is based in Dunlop Memorial Hall, Main Street, Dreghorn, KA11 4AQ.',
  },
  {
    bandName: 'Knottingley Silver Band',
    town: 'Knottingley',
    county: 'West Yorkshire',
    postcode: 'WF11 8EX',
    evidenceUrl: 'https://knottingleysilverband.com/',
    note: 'Official Band site gives its rehearsal venue as the band room, Knottingley Club car park, 29 Hill Top, WF11 8EX.',
  },
  {
    bandName: 'Perthshire Brass',
    town: 'Perth',
    county: 'Perth and Kinross',
    postcode: 'PH2 0HS',
    evidenceUrl: 'https://www.perthshirebrass.org.uk/about-us/',
    note: 'Official Band site identifies its base/contact at Darnhall Tennis Club, Orchard Place, Perth, PH2 0HS and describes weekly rehearsals.',
  },
  {
    bandName: 'Valley Brass (Haydock) Band',
    town: 'Haydock',
    county: 'Merseyside',
    postcode: 'WA11 0AH',
    evidenceUrl: 'https://www.sthelens.gov.uk/media/13433/Blackbrook/pdf/Blackbrook.pdf',
    note: 'Local authority record states Valley Brass has operated from the Richard Evans Community Centre, West End Road, Haydock, WA11 0AH since 2013.',
  },
  {
    bandName: 'Whitburn Band',
    town: 'Whitburn',
    county: 'West Lothian',
    postcode: 'EH47 0PX',
    evidenceUrl: 'https://www.sbba.org.uk/news/7236/2026-sbba-agm-and-learning-festival',
    note: 'Current Scottish Brass Band Association notice identifies Whitburn Band Hall at Murraysgate Industrial Estate, Whitburn, EH47 0PX.',
  },
];

const CLAIMS_BY_NAME = new Map(REVIEWED_BAND_LOCATION_CLAIMS.map((claim) => [key(claim.bandName), claim]));

export function reviewedLocationClaimFor(name: string): ReviewedBandLocationClaim | undefined {
  return CLAIMS_BY_NAME.get(key(name));
}

/** Apply a stronger reviewed location claim to an in-memory projection before
 * canonical creation while retaining the original inferred evidence. */
export function applyReviewedLocationClaim(projection: BrassBandProjectionPackage): BrassBandProjectionPackage {
  const claim = reviewedLocationClaimFor(projection.record.name);
  if (!claim) return projection;

  const next = structuredClone(projection);
  const brass = next.record.domainProfiles.brass;
  brass.town = claim.town;
  brass.county = claim.county;
  brass.postcode = claim.postcode;
  brass.sourceRefs = [...new Set([...brass.sourceRefs, claim.evidenceUrl])];
  next.record.location = [claim.town, claim.county].filter(Boolean).join(', ');
  next.provenance.sourceUrls = [...new Set([...next.provenance.sourceUrls, claim.evidenceUrl])];
  next.enrichmentFlags = next.enrichmentFlags.filter((flag) => flag !== 'precise_band_location_not_resolved');
  return next;
}
