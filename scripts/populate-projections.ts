import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const CONSTITUENCIES_DIR = path.resolve("data/constituencies");

interface PartyProjection {
  party: string;
  share: number;
  status: "will-win" | "could-win" | "might-win";
}

interface Projection {
  projection: string;
  projectionSource: string;
  competitiveness: "safe" | "competitive" | "marginal" | "toss-up";
  topParties: PartyProjection[];
}

const OVERRIDES: Record<string, Projection> = {
  // Edinburgh seats
  "edinburgh-central": {
    projection: "green",
    projectionSource: "Ballot Box Scotland notional results adjusted for local Green incumbency",
    competitiveness: "toss-up",
    topParties: [
      { party: "green", share: 30, status: "could-win" },
      { party: "snp", share: 28, status: "could-win" },
      { party: "labour", share: 25, status: "could-win" },
    ],
  },
  "edinburgh-north-western": {
    projection: "libdem",
    projectionSource: "Ballot Box Scotland notional results; Lib Dem incumbency advantage",
    competitiveness: "safe",
    topParties: [
      { party: "libdem", share: 42, status: "will-win" },
      { party: "snp", share: 22, status: "might-win" },
      { party: "labour", share: 18, status: "might-win" },
    ],
  },
  "edinburgh-southern": {
    projection: "labour",
    projectionSource: "Ballot Box Scotland notional results with Labour local council gains",
    competitiveness: "competitive",
    topParties: [
      { party: "labour", share: 32, status: "could-win" },
      { party: "snp", share: 30, status: "could-win" },
      { party: "green", share: 15, status: "might-win" },
    ],
  },
  "edinburgh-northern": {
    projection: "libdem",
    projectionSource: "Ballot Box Scotland notional results; Lib Dem incumbency advantage",
    competitiveness: "competitive",
    topParties: [
      { party: "libdem", share: 35, status: "could-win" },
      { party: "snp", share: 28, status: "could-win" },
      { party: "labour", share: 20, status: "might-win" },
    ],
  },
  "edinburgh-eastern-musselburgh-and-tranent": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 28, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "edinburgh-north-eastern-and-leith": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 32, status: "could-win" },
      { party: "labour", share: 27, status: "could-win" },
      { party: "green", share: 16, status: "might-win" },
    ],
  },
  "edinburgh-south-western": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "libdem", share: 16, status: "might-win" },
    ],
  },
  // Glasgow seats — Labour targets
  "glasgow-central": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Glasgow council vote trends",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 32, status: "could-win" },
      { party: "labour", share: 30, status: "could-win" },
      { party: "reform", share: 12, status: "might-win" },
    ],
  },
  "glasgow-southside": {
    projection: "labour",
    projectionSource: "Ballot Box Scotland notional results; Glasgow council vote trends",
    competitiveness: "competitive",
    topParties: [
      { party: "labour", share: 33, status: "could-win" },
      { party: "snp", share: 30, status: "could-win" },
      { party: "reform", share: 12, status: "might-win" },
    ],
  },
  "glasgow-anniesland": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Glasgow council vote trends",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 29, status: "could-win" },
      { party: "reform", share: 12, status: "might-win" },
    ],
  },
  "glasgow-baillieston-and-shettleston": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; strong SNP incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 40, status: "will-win" },
      { party: "labour", share: 24, status: "might-win" },
      { party: "reform", share: 12, status: "might-win" },
    ],
  },
  "glasgow-cathcart-and-pollok": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Glasgow council vote trends",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 28, status: "could-win" },
      { party: "reform", share: 12, status: "might-win" },
    ],
  },
  "glasgow-easterhouse-and-springburn": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; strong SNP incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 38, status: "will-win" },
      { party: "labour", share: 26, status: "might-win" },
      { party: "reform", share: 12, status: "might-win" },
    ],
  },
  "glasgow-kelvin-and-maryhill": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Green vote share from 2022 council results",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 32, status: "could-win" },
      { party: "labour", share: 24, status: "could-win" },
      { party: "green", share: 18, status: "could-win" },
    ],
  },
  // Lib Dem strongholds
  "orkney-islands": {
    projection: "libdem",
    projectionSource: "Historical results; Lib Dem hold since 1950 with strong incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "libdem", share: 55, status: "will-win" },
      { party: "snp", share: 20, status: "might-win" },
      { party: "conservative", share: 10, status: "might-win" },
    ],
  },
  "shetland-islands": {
    projection: "libdem",
    projectionSource: "Historical results; Lib Dem hold since 1965 with strong incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "libdem", share: 50, status: "will-win" },
      { party: "snp", share: 22, status: "might-win" },
      { party: "conservative", share: 12, status: "might-win" },
    ],
  },
  "fife-north-east": {
    projection: "libdem",
    projectionSource: "Ballot Box Scotland notional results; Lib Dem incumbency advantage",
    competitiveness: "competitive",
    topParties: [
      { party: "libdem", share: 35, status: "could-win" },
      { party: "snp", share: 28, status: "could-win" },
      { party: "conservative", share: 18, status: "might-win" },
    ],
  },
  // Conservative-held seats under pressure from Reform
  "ettrick-roxburgh-and-berwickshire": {
    projection: "conservative",
    projectionSource: "Ballot Box Scotland notional results adjusted for Reform UK vote share",
    competitiveness: "competitive",
    topParties: [
      { party: "conservative", share: 30, status: "could-win" },
      { party: "snp", share: 22, status: "could-win" },
      { party: "reform", share: 18, status: "might-win" },
    ],
  },
  "galloway-and-west-dumfries": {
    projection: "conservative",
    projectionSource: "Ballot Box Scotland notional results adjusted for Reform UK vote share",
    competitiveness: "competitive",
    topParties: [
      { party: "conservative", share: 28, status: "could-win" },
      { party: "snp", share: 25, status: "could-win" },
      { party: "reform", share: 20, status: "could-win" },
    ],
  },
  "dumfriesshire": {
    projection: "conservative",
    projectionSource: "Ballot Box Scotland notional results adjusted for Reform UK vote share",
    competitiveness: "competitive",
    topParties: [
      { party: "conservative", share: 30, status: "could-win" },
      { party: "snp", share: 24, status: "could-win" },
      { party: "reform", share: 18, status: "might-win" },
    ],
  },
  // SNP safe seats
  "dundee-city-east": {
    projection: "snp",
    projectionSource: "Historical results and national polling; strong SNP incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 42, status: "will-win" },
      { party: "labour", share: 22, status: "might-win" },
      { party: "reform", share: 12, status: "might-win" },
    ],
  },
  "dundee-city-west": {
    projection: "snp",
    projectionSource: "Historical results and national polling; strong SNP incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 40, status: "will-win" },
      { party: "labour", share: 24, status: "might-win" },
      { party: "reform", share: 12, status: "might-win" },
    ],
  },
  // Northeast — SNP but Conservative/Reform competition
  "aberdeenshire-east": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split in NE Scotland",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 32, status: "could-win" },
      { party: "conservative", share: 22, status: "could-win" },
      { party: "reform", share: 18, status: "might-win" },
    ],
  },
  "aberdeenshire-west": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split in NE Scotland",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 30, status: "could-win" },
      { party: "conservative", share: 24, status: "could-win" },
      { party: "reform", share: 18, status: "might-win" },
    ],
  },
  "aberdeen-central": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 22, status: "could-win" },
      { party: "reform", share: 16, status: "might-win" },
    ],
  },
  "aberdeen-donside": {
    projection: "snp",
    projectionSource: "Historical results and national polling; strong SNP incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 38, status: "will-win" },
      { party: "conservative", share: 20, status: "might-win" },
      { party: "labour", share: 16, status: "might-win" },
    ],
  },
  "aberdeen-deeside-and-north-kincardine": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split in NE Scotland",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 31, status: "could-win" },
      { party: "conservative", share: 26, status: "could-win" },
      { party: "reform", share: 18, status: "might-win" },
    ],
  },
  "banffshire-and-buchan-coast": {
    projection: "snp",
    projectionSource: "Historical results and national polling; strong SNP incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 40, status: "will-win" },
      { party: "conservative", share: 20, status: "might-win" },
      { party: "reform", share: 16, status: "might-win" },
    ],
  },
  "moray": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split in NE Scotland",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "conservative", share: 22, status: "could-win" },
      { party: "reform", share: 18, status: "might-win" },
    ],
  },
  // Highlands and Islands
  "caithness-sutherland-and-ross": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Highlands Lib Dem competition factor",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "libdem", share: 20, status: "could-win" },
      { party: "conservative", share: 16, status: "might-win" },
    ],
  },
  "inverness-and-nairn": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Highlands Lib Dem competition factor",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "libdem", share: 22, status: "could-win" },
      { party: "labour", share: 16, status: "might-win" },
    ],
  },
  "skye-lochaber-and-badenoch": {
    projection: "snp",
    projectionSource: "Historical results and national polling; strong SNP incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 42, status: "will-win" },
      { party: "libdem", share: 18, status: "might-win" },
      { party: "labour", share: 14, status: "might-win" },
    ],
  },
  "na-h-eileanan-an-iar": {
    projection: "snp",
    projectionSource: "Historical results; SNP dominant since 2011 with strong incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 48, status: "will-win" },
      { party: "labour", share: 16, status: "might-win" },
      { party: "libdem", share: 14, status: "might-win" },
    ],
  },
  "argyll-and-bute": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Highlands Lib Dem competition factor",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "libdem", share: 24, status: "could-win" },
      { party: "conservative", share: 16, status: "might-win" },
    ],
  },
  // Central Belt / Lothian SNP safe-ish seats
  "almond-valley": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "bathgate": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "midlothian-north": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 28, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "midlothian-south-tweeddale-and-lauderdale": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 32, status: "could-win" },
      { party: "conservative", share: 22, status: "could-win" },
      { party: "labour", share: 18, status: "might-win" },
    ],
  },
  "east-lothian-coast-and-lammermuirs": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 32, status: "could-win" },
      { party: "conservative", share: 22, status: "could-win" },
      { party: "labour", share: 20, status: "might-win" },
    ],
  },
  // Fife seats
  "cowdenbeath": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "dunfermline": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 27, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "kirkcaldy": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "mid-fife-and-glenrothes": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 35, status: "could-win" },
      { party: "labour", share: 24, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "perthshire-north": {
    projection: "snp",
    projectionSource: "Historical results and national polling; strong SNP incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 40, status: "will-win" },
      { party: "conservative", share: 20, status: "might-win" },
      { party: "reform", share: 16, status: "might-win" },
    ],
  },
  "perthshire-south-and-kinross-shire": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "conservative", share: 22, status: "could-win" },
      { party: "libdem", share: 16, status: "might-win" },
    ],
  },
  "stirling": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "conservative", share: 22, status: "could-win" },
      { party: "labour", share: 18, status: "might-win" },
    ],
  },
  "clackmannanshire-and-dunblane": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 24, status: "could-win" },
      { party: "conservative", share: 18, status: "might-win" },
    ],
  },
  // Ayrshire seats
  "ayr": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; three-way Conservative-Reform-SNP split",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 30, status: "could-win" },
      { party: "conservative", share: 24, status: "could-win" },
      { party: "reform", share: 18, status: "could-win" },
    ],
  },
  "carrick-cumnock-and-doon-valley": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 24, status: "could-win" },
      { party: "reform", share: 16, status: "might-win" },
    ],
  },
  "cunninghame-north": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 24, status: "could-win" },
      { party: "reform", share: 15, status: "might-win" },
    ],
  },
  "cunninghame-south": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 24, status: "could-win" },
      { party: "reform", share: 15, status: "might-win" },
    ],
  },
  "kilmarnock-and-irvine-valley": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  // Renfrewshire / West
  "paisley": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
  "renfrewshire-north-and-cardonald": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 27, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
  "renfrewshire-west-and-levern-valley": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  // Lanarkshire seats
  "airdrie": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 28, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
  "coatbridge-and-chryston": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 28, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
  "cumbernauld-and-kilsyth": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 35, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
  "hamilton-larkhall-and-stonehouse": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 27, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "motherwell-and-wishaw": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 28, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
  "uddingston-and-bellshill": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 27, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "rutherglen-and-cambuslang": {
    projection: "labour",
    projectionSource: "Ballot Box Scotland notional results; Labour by-election gain in 2023",
    competitiveness: "competitive",
    topParties: [
      { party: "labour", share: 34, status: "could-win" },
      { party: "snp", share: 30, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
  "east-kilbride": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 27, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
  "clydesdale": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 32, status: "could-win" },
      { party: "conservative", share: 22, status: "could-win" },
      { party: "reform", share: 16, status: "might-win" },
    ],
  },
  // West / Dumbarton
  "clydebank-and-milngavie": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 26, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
  "dumbarton": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 25, status: "could-win" },
      { party: "libdem", share: 14, status: "might-win" },
    ],
  },
  "strathkelvin-and-bearsden": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 33, status: "could-win" },
      { party: "labour", share: 24, status: "could-win" },
      { party: "libdem", share: 16, status: "might-win" },
    ],
  },
  "eastwood": {
    projection: "conservative",
    projectionSource: "Ballot Box Scotland notional results; Conservative incumbency advantage",
    competitiveness: "competitive",
    topParties: [
      { party: "conservative", share: 30, status: "could-win" },
      { party: "snp", share: 26, status: "could-win" },
      { party: "labour", share: 20, status: "could-win" },
    ],
  },
  // Falkirk seats
  "falkirk-east-and-linlithgow": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 25, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  "falkirk-west": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 25, status: "could-win" },
      { party: "reform", share: 14, status: "might-win" },
    ],
  },
  // Angus
  "angus-north-and-mearns": {
    projection: "snp",
    projectionSource: "Historical results and national polling; strong SNP incumbency",
    competitiveness: "safe",
    topParties: [
      { party: "snp", share: 38, status: "will-win" },
      { party: "conservative", share: 20, status: "might-win" },
      { party: "reform", share: 16, status: "might-win" },
    ],
  },
  "angus-south": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results; Conservative-Reform vote split",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 35, status: "could-win" },
      { party: "conservative", share: 22, status: "could-win" },
      { party: "reform", share: 16, status: "might-win" },
    ],
  },
  "inverclyde": {
    projection: "snp",
    projectionSource: "Ballot Box Scotland notional results with national polling swing",
    competitiveness: "competitive",
    topParties: [
      { party: "snp", share: 34, status: "could-win" },
      { party: "labour", share: 27, status: "could-win" },
      { party: "reform", share: 13, status: "might-win" },
    ],
  },
};

function readYaml(filePath: string): Record<string, unknown> {
  return yaml.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

function writeYaml(filePath: string, data: Record<string, unknown>) {
  fs.writeFileSync(filePath, yaml.stringify(data, { lineWidth: 0 }));
}

function main() {
  const files = fs.readdirSync(CONSTITUENCIES_DIR).filter((f) => f.endsWith(".yaml"));
  let updatedCount = 0;

  for (const file of files) {
    const filePath = path.join(CONSTITUENCIES_DIR, file);
    const constituency = readYaml(filePath);
    const id = constituency.id as string;

    const proj = OVERRIDES[id];
    if (!proj) {
      throw new Error(`No projection override found for constituency: ${id}`);
    }

    constituency.projection = proj.projection;
    constituency.projectionSource = proj.projectionSource;
    constituency.competitiveness = proj.competitiveness;
    constituency.topParties = proj.topParties;

    writeYaml(filePath, constituency);
    updatedCount++;
  }

  console.log(`Updated ${updatedCount} constituency files with projection data.`);
}

main();
