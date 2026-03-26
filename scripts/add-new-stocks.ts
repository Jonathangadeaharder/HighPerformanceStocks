import { writeFileSync } from 'node:fs';
/* eslint-disable sonarjs/no-duplicate-string */
import 'dotenv/config';
import { resolve } from 'node:path';

const stocks = [
	// Capital Compounders
	{
		ticker: 'LAGR-B.ST',
		name: 'Lagercrantz Group',
		group: 'Capital Compounders',
		confidence: 'high',
		reason: 'Identical niche-B2B M&A model to Addtech/Lifco. Grows EPS beautifully at 15–20%+.'
	},
	{
		ticker: 'KNSL',
		name: 'Kinsale Capital',
		group: 'Financials & Alt Assets',
		confidence: 'high',
		reason: 'E&S insurer using proprietary tech to dominate niche. EPS compounds at 20–30% a year.'
	},
	{
		ticker: 'CPRT',
		name: 'Copart',
		group: 'Capital Compounders',
		confidence: 'high',
		reason:
			'Unassailable monopoly in salvage auto auctions. Very little capex requirement, consistent 12–18% growth.'
	},
	{
		ticker: 'INDT.ST',
		name: 'Indutrade',
		group: 'Capital Compounders',
		confidence: 'high',
		reason:
			'Swedish serial acquirer of niche B2B industrial tech. Extremely consistent 15%+ EPS compounder.'
	},
	{
		ticker: 'JDG.L',
		name: 'Judges Scientific',
		group: 'Capital Compounders',
		confidence: 'high',
		reason:
			'UK-based buyer of specialized scientific instrument manufacturers. Incredible return on capital.'
	},
	{
		ticker: 'DSG.TO',
		name: 'Descartes Systems',
		group: 'Data & Software Monopolies',
		confidence: 'high',
		reason:
			'Logistics/supply chain software serial acquirer (similar to CSU focused on global trade).'
	},
	{
		ticker: 'WSO',
		name: 'Watsco',
		group: 'Capital Compounders',
		confidence: 'high',
		reason:
			'HVAC distribution serial acquirer. Massive dividend growth, zero debt, ruthless efficiency.'
	},

	// Alt Assets / Financials
	{
		ticker: 'ARES',
		name: 'Ares Management',
		group: 'Financials & Alt Assets',
		confidence: 'high',
		reason: 'Heavyweight champion of private credit. Relentless FRE growth.',
		basis: 'FRE per share'
	},
	{
		ticker: 'SPGI',
		name: 'S&P Global',
		group: 'Data & Software Monopolies',
		confidence: 'high',
		reason: 'Asset-light, unregulated duopoly with infinite pricing power.'
	},
	{
		ticker: 'MCO',
		name: "Moody's",
		group: 'Data & Software Monopolies',
		confidence: 'high',
		reason: 'Asset-light, unregulated duopoly with infinite pricing power.'
	},
	{
		ticker: 'TW',
		name: 'Tradeweb',
		group: 'Financials & Alt Assets',
		confidence: 'high',
		reason:
			'Electronic bond trading matching traditional voice-brokers. Asset-light, massive operating leverage.'
	},
	{
		ticker: 'MKTX',
		name: 'MarketAxess',
		group: 'Financials & Alt Assets',
		confidence: 'high',
		reason: 'Electronic bond trading taking market share. 15-20% revenue growth, massive leverage.'
	},
	{
		ticker: 'IBKR',
		name: 'Interactive Brokers',
		group: 'Financials & Alt Assets',
		confidence: 'high',
		reason: 'Highest margin brokerage globally. User base expands ~20% YoY. Deep margin moats.'
	},

	// Healthcare Monopolies
	{
		ticker: 'MCK',
		name: 'McKesson',
		group: 'Healthcare Monopolies',
		confidence: 'high',
		reason:
			'Consolidated oligopoly drug distributor. Massive share repurchases lead to consistent 12–15% EPS growth floors.'
	},
	{
		ticker: 'COR',
		name: 'Cencora',
		group: 'Healthcare Monopolies',
		confidence: 'high',
		reason:
			'Consolidated oligopoly drug distributor with immense cash flow and repurchase programs.'
	},
	{
		ticker: 'MEDP',
		name: 'Medpace',
		group: 'Healthcare Monopolies',
		confidence: 'high',
		reason:
			'Leading CRO for small-mid biotechs. Excellent compounding (20%+ EPS growth). Buy the biotech funding panic.'
	},
	{
		ticker: 'ICLR',
		name: 'ICON plc',
		group: 'Healthcare Monopolies',
		confidence: 'high',
		reason:
			'Massive CRO running trials for big pharma. Consistent 12-16% EPS growth, often very reasonably priced.'
	},
	{
		ticker: 'WST',
		name: 'West Pharmaceutical',
		group: 'Healthcare Monopolies',
		confidence: 'high',
		reason:
			'Near-monopoly on specialized rubber stoppers/seals for injectables (GLP-1s). High-margin, high-moat.'
	},
	{
		ticker: 'ZTS',
		name: 'Zoetis',
		group: 'Healthcare Monopolies',
		confidence: 'high',
		reason:
			'Global monopoly in animal health/vaccines. No insurance price caps equals incredible pricing power.'
	},

	// Data / Software Monopolies
	{
		ticker: 'VRSK',
		name: 'Verisk Analytics',
		group: 'Data & Software Monopolies',
		confidence: 'high',
		reason:
			"The 'FICO of insurance'. Proprietary databases for P&C insurers. Asset-light, massive margins."
	},
	{
		ticker: 'IT',
		name: 'Gartner',
		group: 'Data & Software Monopolies',
		confidence: 'high',
		reason:
			'Monopoly in enterprise IT research. Massive free cash flow and relentless share buybacks.'
	},
	{
		ticker: 'FTNT',
		name: 'Fortinet',
		group: 'Data & Software Monopolies',
		confidence: 'high',
		reason:
			'Hardware+software security cycles at much cheaper P/E than CRWD/PANW. Buy on billing cycle panics.'
	},

	// Industrial Monopolies
	{
		ticker: 'HWM',
		name: 'Howmet Aerospace',
		group: 'Industrial Monopolies',
		confidence: 'high',
		reason: 'Heavy IP moats in forged jet engine blades/fasteners. Aerospace super-cycle momentum.'
	},
	{
		ticker: 'URI',
		name: 'United Rentals',
		group: 'Industrial Monopolies',
		confidence: 'high',
		reason:
			'NA equipment rental leader. Massive scale, heavy operational momentum from infrastructure cycles.'
	},

	// Travel / Transport
	{
		ticker: 'UBER',
		name: 'Uber Technologies',
		group: 'Data & Software Monopolies',
		confidence: 'medium',
		reason:
			'Stabilized business yielding massive margin expansion and forward EPS growth projections (20-40%).'
	},
	{
		ticker: 'BKNG',
		name: 'Booking Holdings',
		group: 'Data & Software Monopolies',
		confidence: 'high',
		reason: 'Textbook GARP. Shrinking float, increasing margins, stable 15%+ EPS growth.'
	},

	// Energy Royalties
	{
		ticker: 'PSK.TO',
		name: 'PrairieSky Royalty',
		group: 'Energy & Infrastructure',
		confidence: 'high',
		reason: 'Canadian equivalent of TPL. Fee-simple land royalties. Zero capex, pure FCF.'
	},
	{
		ticker: 'TPZ.TO',
		name: 'Topaz Energy',
		group: 'Energy & Infrastructure',
		confidence: 'high',
		reason: 'Canadian royalty tied to natural gas and LNG buildout. High yield + growth.'
	}
];

const DATA_DIR = resolve('./data/stock-records');

for (const s of stocks) {
	const json = {
		ticker: s.ticker,
		name: s.name,
		group: s.group,
		confidence: s.confidence,
		confidenceReason: s.reason,
		cagrModel: {
			epsGrowth: '15%',
			epsGrowthSource: 'auto',
			basis: s.basis ?? 'Non-GAAP EPS'
		}
	};

	writeFileSync(resolve(DATA_DIR, `${s.ticker}.json`), JSON.stringify(json, null, '\t') + '\n');
}

console.log(`Created ${stocks.length} new tracking records.`);
