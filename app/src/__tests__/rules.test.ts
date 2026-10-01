import { counts, emptyForce, forceReducer, fromList, toDraft, type Force, type ForceAction } from "../builder/force";
import { allyUnits, assetById, assetsFor, eligibleTargets, rosterUnits, typeName, unitById, validate } from "../builder/rules";

const build = (...actions: ForceAction[]) => actions.reduce(forceReducer, emptyForce());
const add = (unit: string, n = 1): ForceAction[] => Array.from({ length: n }, () => ({ type: "add", unit }));
const check = (f: Force) => {
  const { force, kit } = counts(f);
  return validate(force, kit, f.faction, f.gameSize, f.allegiance);
};
const codes = (f: Force) => check(f).issues.map((i) => i.code);

describe("validate", () => {
  it("has nothing to report for an empty force", () => {
    expect(check(emptyForce())).toMatchObject({ issues: [], dp: 0, unitCount: 0 });
  });

  it("requires a Leader", () => {
    expect(codes(build(...add("bauhaus_blitzer_base")))).toEqual(["no_leader"]);
  });

  it("requires a Trooper of the right type for each Leader and Specialist", () => {
    const f = build(...add("bauhaus_blitzer_leader"), ...add("bauhaus_venusian_ranger_medic"));
    expect(codes(f)).toEqual(["leader_requirement", "specialist_requirement"]);
    const fixed = build(...add("bauhaus_blitzer_leader"), ...add("bauhaus_blitzer_base"));
    expect(codes(fixed)).toEqual([]);
  });

  it("counts DP and Support points and flags overspending", () => {
    // Leader +2 SP, two HMG Rangers spend 3 SP each.
    const f = build(...add("bauhaus_blitzer_leader"), ...add("bauhaus_blitzer_base"), ...add("bauhaus_venusian_ranger_hmg", 2));
    const v = check(f);
    expect(v).toMatchObject({ dp: 17, spAvail: 2, spSpent: 6 });
    expect(v.issues.find((i) => i.code === "sp_overspent")).toMatchObject({ sev: "warn" });
  });

  it("flags a force over the game size", () => {
    const f = build({ type: "setGameSize", gameSize: 20 }, ...add("bauhaus_blitzer_leader"), ...add("bauhaus_blitzer_base", 4));
    expect(check(f).issues.find((i) => i.code === "dp_over_limit")?.text).toBe("Force is 1 DP over the 20 DP limit");
  });

  it("rejects an ally the allegiance doesn't allow", () => {
    // Seconding (Brotherhood) allies need Agents of Light.
    const base = [...add("bauhaus_blitzer_leader"), ...add("bauhaus_blitzer_base"), ...add("brotherhood_mortificator_base")];
    expect(codes(build(...base))).toEqual([]);
    const dark = build(...base, { type: "setAllegiance", allegiance: "servants_of_darkness" });
    expect(check(dark).issues).toEqual([
      { code: "ally_not_allowed", sev: "error", text: "Mortificator: Seconding allies can only join Agents of Light forces" },
    ]);
    // Dark Cult allies need Servants of Darkness.
    const cult = build(...add("bauhaus_blitzer_leader"), ...add("bauhaus_blitzer_base"), ...add("algeroth_necromutant_base"));
    expect(codes(cult)).toEqual(["ally_not_allowed"]);
    expect(codes(forceReducer(cult, { type: "setAllegiance", allegiance: "servants_of_darkness" }))).toEqual([]);
  });

  it("caps allies at a fifth of the game size", () => {
    const f = build(...add("bauhaus_blitzer_leader"), ...add("bauhaus_blitzer_base"), ...add("brotherhood_mortificator_base", 2));
    expect(check(f)).toMatchObject({ allyDp: 12, allyLimit: 8 });
    expect(codes(f)).toContain("ally_share_exceeded");
  });
});

describe("allies and assets", () => {
  it("offers allies by allegiance", () => {
    const light = allyUnits("bauhaus", "agents_of_light").map((u) => u.ally);
    const dark = allyUnits("bauhaus", "servants_of_darkness").map((u) => u.ally);
    expect(light).toContain("seconding");
    expect(light).not.toContain("dark_cult");
    expect(dark).toContain("dark_cult");
    expect(dark).not.toContain("seconding");
    // Every ally designation is closed to Dark Legion forces.
    expect(allyUnits("algeroth", "servants_of_darkness")).toEqual([]);
  });

  it("lists faction and group assets and finds legal targets", () => {
    const ids = assetsFor("capitol").map((a) => a.id);
    expect(ids).toContain("air_strike");
    expect(ids).toContain("command_helmet");
    expect(ids).not.toContain("fire_support");
    const helmet = assetById("command_helmet")!;
    const targets = eligibleTargets(helmet, [unitById("capitol_free_marine_leader")!, unitById("capitol_free_marine_base")!]);
    expect(targets.map((u) => u.id)).toEqual(["capitol_free_marine_leader"]);
  });
});

describe("force", () => {
  it("allows one copy of a Unique unit", () => {
    const f = build(...add("bauhaus_friedrich_wachtmeister_base", 2));
    expect(f.units).toHaveLength(1);
  });

  it("takes each asset once and only on a legal target", () => {
    let f = build(...add("bauhaus_blitzer_leader"), ...add("bauhaus_blitzer_base"));
    const [leader, trooper] = f.units;
    f = forceReducer(f, { type: "attach", asset: "command_helmet", i: trooper.i });
    f = forceReducer(f, { type: "attach", asset: "command_helmet", i: leader.i });
    f = forceReducer(f, { type: "attach", asset: "command_helmet", i: leader.i });
    expect(f.units.map((x) => x.k)).toEqual([["command_helmet"], []]);
    f = forceReducer(f, { type: "addForceAsset", asset: "fire_support" });
    f = forceReducer(f, { type: "addForceAsset", asset: "fire_support" });
    expect(f.forceAssets).toHaveLength(1);
    expect(check(f).dp).toBe(11);
  });

  it("empties the force when the faction changes", () => {
    const f = build(...add("bauhaus_blitzer_leader"), { type: "setFaction", faction: "capitol" });
    expect(f).toMatchObject({ faction: "capitol", units: [], forceAssets: [] });
  });

  it("round-trips through a saved list", () => {
    let f = build({ type: "setFaction", faction: "capitol" }, ...add("capitol_free_marine_leader"), ...add("capitol_free_marine_base", 2));
    f = forceReducer(f, { type: "attach", asset: "air_strike", i: f.units[0].i });
    f = forceReducer(f, { type: "addForceAsset", asset: "supply_drop" });
    const draft = toDraft("Test", f);
    expect(draft).toMatchObject({ faction: "Capitol", allegiance: "agents_of_light", gameSize: "Standard", points: 15, limit: 40, unitCount: 3 });
    const back = fromList(draft);
    expect(toDraft("Test", back)).toEqual(draft);
  });

  it("opens a list saved before the builder existed", () => {
    const f = fromList({ faction: "Capitol", allegiance: "servants_of_darkness", limit: 30, roster: {} });
    expect(f).toMatchObject({ faction: "capitol", gameSize: 30, allegiance: "servants_of_darkness", units: [] });
  });
});

describe("data fixes", () => {
  const faction = (fid: string, allegiance: "agents_of_light" | "servants_of_darkness" = "agents_of_light"): ForceAction[] => [
    { type: "setFaction", faction: fid },
    { type: "setAllegiance", allegiance },
  ];

  it("gives a faction its own ally-designated units as ordinary units", () => {
    // Algeroth's Troopers are Dark Cult allies for other factions, but plain Troopers for Algeroth.
    expect(rosterUnits("algeroth").map((u) => u.id)).toContain("algeroth_necromutant_base");
    let f = build(
      ...faction("algeroth", "servants_of_darkness"),
      ...add("algeroth_necromutant_leader"),
      ...add("algeroth_undead_legionnaire_base", 2),
    );
    expect(check(f)).toMatchObject({ issues: [], allyDp: 0 });
    // The Alpha Legionnaire asset now has an Undead Legionnaire to go on.
    f = forceReducer(f, { type: "attach", asset: "alpha_legionnaire", i: f.units[1].i });
    expect(f.units[1].k).toEqual(["alpha_legionnaire"]);

    const brotherhood = build(...faction("brotherhood"), ...add("brotherhood_mortificator_leader"), ...add("brotherhood_mortificator_base"));
    expect(check(brotherhood)).toMatchObject({ issues: [], allyDp: 0 });
  });

  it("reads 'any Brotherhood' as any Brotherhood Trooper", () => {
    const leader = add("brotherhood_fury_elite_guard_leader");
    expect(check(build(...faction("brotherhood"), ...leader)).issues[0].text).toBe(
      "Fury Elite Guard // Leader needs 1 × Trooper of type any Brotherhood, 0 available",
    );
    expect(codes(build(...faction("brotherhood"), ...leader, ...add("brotherhood_sacred_warrior_base")))).toEqual([]);
    expect(typeName("any_brotherhood")).toBe("any Brotherhood");
  });

  it("lets the Mirrorman Leader lead Mirrormen", () => {
    expect(codes(build(...faction("cybertronic"), ...add("cybertronic_mirrorman_leader"), ...add("cybertronic_mirrorman_base")))).toEqual([]);
  });

  it("keeps Dr. Diana's Leader and Specialist apart", () => {
    expect(unitById("cybertronic_dr_diana_base")?.dg).toBe("leader");
    expect(unitById("cybertronic_dr_diana_specialist")?.dg).toBe("specialist");
    const f = build(...faction("cybertronic"), ...add("cybertronic_dr_diana_specialist"));
    expect(f.units.map((x) => unitById(x.u)?.dg)).toEqual(["specialist"]);
  });
});
