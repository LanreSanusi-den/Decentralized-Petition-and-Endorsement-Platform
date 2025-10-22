import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_PETITION_ID = 101;
const ERR_INVALID_SUPPORTER = 102;
const ERR_ALREADY_SUPPORTED = 103;
const ERR_PETITION_NOT_FOUND = 104;
const ERR_INVALID_TIMESTAMP = 105;
const ERR_AUTHORITY_NOT_VERIFIED = 106;
const ERR_INVALID_COUNT = 107;
const ERR_INVALID_THRESHOLD = 108;
const ERR_MAX_PETITIONS_EXCEEDED = 109;
const ERR_INVALID_STATUS = 110;
const ERR_INVALID_UPDATE_PARAM = 111;
const ERR_UPDATE_NOT_ALLOWED = 112;
const ERR_INVALID_LOCATION = 113;
const ERR_INVALID_CURRENCY = 114;
const ERR_INVALID_GRACE_PERIOD = 115;
const ERR_INVALID_INTEREST_RATE = 116;
const ERR_INVALID_GROUP_TYPE = 117;
const ERR_SUPPORT_ALREADY_EXISTS = 118;
const ERR_INVALID_MIN_SUPPORT = 119;
const ERR_INVALID_MAX_SUPPORT = 120;

interface Petition {
  name: string;
  supportCount: number;
  uniqueSupporters: number;
  timestamp: number;
  creator: string;
  status: boolean;
  threshold: number;
  location: string;
  currency: string;
  gracePeriod: number;
  interestRate: number;
  groupType: string;
  minSupport: number;
  maxSupport: number;
}

interface PetitionUpdate {
  updateName: string;
  updateThreshold: number;
  updateTimestamp: number;
  updater: string;
}

interface Support {
  timestamp: number;
  verified: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class SupportTrackerMock {
  state: {
    nextPetitionId: number;
    maxPetitions: number;
    trackingFee: number;
    authorityContract: string | null;
    petitions: Map<number, Petition>;
    petitionUpdates: Map<number, PetitionUpdate>;
    petitionsByName: Map<string, number>;
    supports: Map<string, Support>;
    supporterPetitions: Map<string, number[]>;
  } = {
    nextPetitionId: 0,
    maxPetitions: 1000,
    trackingFee: 1000,
    authorityContract: null,
    petitions: new Map(),
    petitionUpdates: new Map(),
    petitionsByName: new Map(),
    supports: new Map(),
    supporterPetitions: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextPetitionId: 0,
      maxPetitions: 1000,
      trackingFee: 1000,
      authorityContract: null,
      petitions: new Map(),
      petitionUpdates: new Map(),
      petitionsByName: new Map(),
      supports: new Map(),
      supporterPetitions: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setTrackingFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.trackingFee = newFee;
    return { ok: true, value: true };
  }

  setMaxPetitions(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newMax <= 0) return { ok: false, value: false };
    this.state.maxPetitions = newMax;
    return { ok: true, value: true };
  }

  registerPetition(
    name: string,
    threshold: number,
    location: string,
    currency: string,
    gracePeriod: number,
    interestRate: number,
    groupType: string,
    minSupport: number,
    maxSupport: number
  ): Result<number> {
    if (this.state.nextPetitionId >= this.state.maxPetitions) return { ok: false, value: ERR_MAX_PETITIONS_EXCEEDED };
    if (!name || name.length > 100) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (threshold <= 0) return { ok: false, value: ERR_INVALID_THRESHOLD };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (interestRate > 20) return { ok: false, value: ERR_INVALID_INTEREST_RATE };
    if (!["rural", "urban", "community"].includes(groupType)) return { ok: false, value: ERR_INVALID_GROUP_TYPE };
    if (minSupport <= 0) return { ok: false, value: ERR_INVALID_MIN_SUPPORT };
    if (maxSupport <= 0) return { ok: false, value: ERR_INVALID_MAX_SUPPORT };
    if (this.state.petitionsByName.has(name)) return { ok: false, value: ERR_SUPPORT_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.trackingFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextPetitionId;
    const petition: Petition = {
      name,
      supportCount: 0,
      uniqueSupporters: 0,
      timestamp: this.blockHeight,
      creator: this.caller,
      status: true,
      threshold,
      location,
      currency,
      gracePeriod,
      interestRate,
      groupType,
      minSupport,
      maxSupport,
    };
    this.state.petitions.set(id, petition);
    this.state.petitionsByName.set(name, id);
    this.state.nextPetitionId++;
    return { ok: true, value: id };
  }

  getPetition(id: number): Petition | null {
    return this.state.petitions.get(id) || null;
  }

  addVerifiedSupport(petitionId: number, supporter: string): Result<boolean> {
    const petition = this.state.petitions.get(petitionId);
    if (!petition) return { ok: false, value: false };
    if (!petition.status) return { ok: false, value: false };
    const supportKey = `${petitionId}-${supporter}`;
    if (this.state.supports.has(supportKey)) return { ok: false, value: false };

    this.state.supports.set(supportKey, {
      timestamp: this.blockHeight,
      verified: true,
    });

    const updatedPetition: Petition = {
      ...petition,
      supportCount: petition.supportCount + 1,
      uniqueSupporters: petition.uniqueSupporters + 1,
    };
    this.state.petitions.set(petitionId, updatedPetition);

    const supporterList = this.state.supporterPetitions.get(supporter) || [];
    supporterList.push(petitionId);
    this.state.supporterPetitions.set(supporter, supporterList);

    return { ok: true, value: true };
  }

  updatePetition(id: number, updateName: string, updateThreshold: number): Result<boolean> {
    const petition = this.state.petitions.get(id);
    if (!petition) return { ok: false, value: false };
    if (petition.creator !== this.caller) return { ok: false, value: false };
    if (!updateName || updateName.length > 100) return { ok: false, value: false };
    if (updateThreshold <= 0) return { ok: false, value: false };
    if (this.state.petitionsByName.has(updateName) && this.state.petitionsByName.get(updateName) !== id) {
      return { ok: false, value: false };
    }

    const updated: Petition = {
      ...petition,
      name: updateName,
      threshold: updateThreshold,
      timestamp: this.blockHeight,
    };
    this.state.petitions.set(id, updated);
    this.state.petitionsByName.delete(petition.name);
    this.state.petitionsByName.set(updateName, id);
    this.state.petitionUpdates.set(id, {
      updateName,
      updateThreshold,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getPetitionCount(): Result<number> {
    return { ok: true, value: this.state.nextPetitionId };
  }

  checkPetitionExistence(name: string): Result<boolean> {
    return { ok: true, value: this.state.petitionsByName.has(name) };
  }

  getVerifiedCount(id: number): Result<number> {
    const petition = this.state.petitions.get(id);
    if (!petition) return { ok: false, value: ERR_PETITION_NOT_FOUND };
    return { ok: true, value: petition.supportCount };
  }

  getUniqueSupporters(id: number): Result<number> {
    const petition = this.state.petitions.get(id);
    if (!petition) return { ok: false, value: ERR_PETITION_NOT_FOUND };
    return { ok: true, value: petition.uniqueSupporters };
  }
}

describe("SupportTracker", () => {
  let contract: SupportTrackerMock;

  beforeEach(() => {
    contract = new SupportTrackerMock();
    contract.reset();
  });

  it("registers a petition successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerPetition(
      "Petition1",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const petition = contract.getPetition(0);
    expect(petition?.name).toBe("Petition1");
    expect(petition?.threshold).toBe(100);
    expect(petition?.location).toBe("LocationX");
    expect(petition?.currency).toBe("STX");
    expect(petition?.gracePeriod).toBe(7);
    expect(petition?.interestRate).toBe(10);
    expect(petition?.groupType).toBe("rural");
    expect(petition?.minSupport).toBe(50);
    expect(petition?.maxSupport).toBe(1000);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate petition names", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerPetition(
      "Petition1",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    const result = contract.registerPetition(
      "Petition1",
      200,
      "LocationY",
      "USD",
      14,
      15,
      "urban",
      100,
      2000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_SUPPORT_ALREADY_EXISTS);
  });

  it("rejects petition registration without authority contract", () => {
    const result = contract.registerPetition(
      "NoAuth",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid threshold", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerPetition(
      "InvalidThreshold",
      0,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_THRESHOLD);
  });

  it("rejects invalid group type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerPetition(
      "InvalidType",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "invalid",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_GROUP_TYPE);
  });

  it("adds verified support successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerPetition(
      "Petition1",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    const result = contract.addVerifiedSupport(0, "ST3SUPPORTER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const count = contract.getVerifiedCount(0);
    expect(count.ok).toBe(true);
    expect(count.value).toBe(1);
    const unique = contract.getUniqueSupporters(0);
    expect(unique.ok).toBe(true);
    expect(unique.value).toBe(1);
  });

  it("rejects adding support to non-existent petition", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.addVerifiedSupport(99, "ST3SUPPORTER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects duplicate support", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerPetition(
      "Petition1",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    contract.addVerifiedSupport(0, "ST3SUPPORTER");
    const result = contract.addVerifiedSupport(0, "ST3SUPPORTER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("updates a petition successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerPetition(
      "OldPetition",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    const result = contract.updatePetition(0, "NewPetition", 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const petition = contract.getPetition(0);
    expect(petition?.name).toBe("NewPetition");
    expect(petition?.threshold).toBe(200);
    const update = contract.state.petitionUpdates.get(0);
    expect(update?.updateName).toBe("NewPetition");
    expect(update?.updateThreshold).toBe(200);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent petition", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updatePetition(99, "NewPetition", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-creator", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerPetition(
      "Petition1",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    contract.caller = "ST3FAKE";
    const result = contract.updatePetition(0, "NewPetition", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets tracking fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setTrackingFee(2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.trackingFee).toBe(2000);
    contract.registerPetition(
      "Petition1",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    expect(contract.stxTransfers).toEqual([{ amount: 2000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects tracking fee change without authority contract", () => {
    const result = contract.setTrackingFee(2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct petition count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerPetition(
      "Petition1",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    contract.registerPetition(
      "Petition2",
      200,
      "LocationY",
      "USD",
      14,
      15,
      "urban",
      100,
      2000
    );
    const result = contract.getPetitionCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks petition existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.registerPetition(
      "Petition1",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    const result = contract.checkPetitionExistence("Petition1");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkPetitionExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses petition parameters with Clarity types", () => {
    const name = stringUtf8CV("Petition1");
    const threshold = uintCV(100);
    expect(name.value).toBe("Petition1");
    expect(threshold.value).toEqual(BigInt(100));
  });

  it("rejects petition registration with empty name", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.registerPetition(
      "",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_UPDATE_PARAM);
  });

  it("rejects petition registration with max petitions exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxPetitions = 1;
    contract.registerPetition(
      "Petition1",
      100,
      "LocationX",
      "STX",
      7,
      10,
      "rural",
      50,
      1000
    );
    const result = contract.registerPetition(
      "Petition2",
      200,
      "LocationY",
      "USD",
      14,
      15,
      "urban",
      100,
      2000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PETITIONS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});