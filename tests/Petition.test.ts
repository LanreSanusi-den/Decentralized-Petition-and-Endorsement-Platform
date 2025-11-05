import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, bufferCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_TITLE = 101;
const ERR_INVALID_DESCRIPTION = 102;
const ERR_INVALID_THRESHOLD = 103;
const ERR_INVALID_DEADLINE = 104;
const ERR_PETITION_ALREADY_EXISTS = 105;
const ERR_PETITION_NOT_FOUND = 106;
const ERR_INVALID_SIGNATURE = 107;
const ERR_ALREADY_SIGNED = 108;
const ERR_DEADLINE_PASSED = 109;
const ERR_INVALID_NONCE = 110;
const ERR_SIGNATURE_REPLAY = 111;
const ERR_THRESHOLD_NOT_MET = 112;
const ERR_INVALID_PETITION_TYPE = 113;
const ERR_MAX_PETITIONS_EXCEEDED = 114;
const ERR_INVALID_CATEGORY = 115;
const ERR_INVALID_LOCATION = 116;
const ERR_INVALID_CURRENCY = 117;
const ERR_INVALID_MIN_SUPPORT = 118;
const ERR_INVALID_MAX_SUPPORT = 119;

interface Petition {
  title: string;
  description: string;
  threshold: number;
  deadline: number;
  timestamp: number;
  creator: string;
  petitionType: string;
  category: string;
  location: string;
  currency: string;
  status: boolean;
  minSupport: number;
  maxSupport: number;
}

interface Signature {
  signature: Buffer;
  nonce: number;
  timestamp: number;
  verified: boolean;
}

interface PetitionUpdate {
  updateTitle: string;
  updateThreshold: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class PetitionMock {
  state: {
    nextPetitionId: number;
    maxPetitions: number;
    creationFee: number;
    authorityContract: string | null;
    petitions: Map<number, Petition>;
    petitionsByTitle: Map<string, number>;
    signatures: Map<string, Signature>;
    petitionSignaturesCount: Map<number, number>;
    petitionUpdates: Map<number, PetitionUpdate>;
  } = {
    nextPetitionId: 0,
    maxPetitions: 500,
    creationFee: 500,
    authorityContract: null,
    petitions: new Map(),
    petitionsByTitle: new Map(),
    signatures: new Map(),
    petitionSignaturesCount: new Map(),
    petitionUpdates: new Map(),
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
      maxPetitions: 500,
      creationFee: 500,
      authorityContract: null,
      petitions: new Map(),
      petitionsByTitle: new Map(),
      signatures: new Map(),
      petitionSignaturesCount: new Map(),
      petitionUpdates: new Map(),
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

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  createPetition(
    title: string,
    description: string,
    threshold: number,
    deadline: number,
    petitionType: string,
    category: string,
    location: string,
    currency: string,
    minSupport: number,
    maxSupport: number
  ): Result<number> {
    if (this.state.nextPetitionId >= this.state.maxPetitions) return { ok: false, value: ERR_MAX_PETITIONS_EXCEEDED };
    if (!title || title.length > 128) return { ok: false, value: ERR_INVALID_TITLE };
    if (!description || description.length > 512) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (threshold <= 0 || threshold > 1000000) return { ok: false, value: ERR_INVALID_THRESHOLD };
    if (deadline <= this.blockHeight) return { ok: false, value: ERR_INVALID_DEADLINE };
    if (!["petition", "endorsement", "proposal"].includes(petitionType)) return { ok: false, value: ERR_INVALID_PETITION_TYPE };
    if (!category || category.length > 64) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (!location || location.length > 128) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "BTC", "USD"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minSupport <= 0) return { ok: false, value: ERR_INVALID_MIN_SUPPORT };
    if (maxSupport <= 0) return { ok: false, value: ERR_INVALID_MAX_SUPPORT };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.petitionsByTitle.has(title)) return { ok: false, value: ERR_PETITION_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: 501 };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextPetitionId;
    const petition: Petition = {
      title,
      description,
      threshold,
      deadline,
      timestamp: this.blockHeight,
      creator: this.caller,
      petitionType,
      category,
      location,
      currency,
      status: true,
      minSupport,
      maxSupport,
    };
    this.state.petitions.set(id, petition);
    this.state.petitionsByTitle.set(title, id);
    this.state.petitionSignaturesCount.set(id, 0);
    this.state.nextPetitionId++;
    return { ok: true, value: id };
  }

  getPetition(id: number): Petition | null {
    return this.state.petitions.get(id) || null;
  }

  addSignature(petitionId: number, signature: Buffer, nonce: number, timestamp: number): Result<boolean> {
    const petition = this.state.petitions.get(petitionId);
    if (!petition) return { ok: false, value: false };
    const key = `${petitionId}-${this.caller}`;
    if (this.state.signatures.has(key)) return { ok: false, value: false };
    if (!petition.status) return { ok: false, value: false };
    if (this.blockHeight > petition.deadline) return { ok: false, value: ERR_DEADLINE_PASSED };
    if (signature.length > 65 || nonce <= 0 || timestamp < this.blockHeight) return { ok: false, value: ERR_INVALID_SIGNATURE };
    if (this.state.signatures.has(key) && timestamp <= (this.state.signatures.get(key)?.timestamp || 0)) return { ok: false, value: ERR_SIGNATURE_REPLAY };

    this.state.signatures.set(key, { signature, nonce, timestamp, verified: true });
    const currentCount = this.state.petitionSignaturesCount.get(petitionId) || 0;
    this.state.petitionSignaturesCount.set(petitionId, currentCount + 1);
    return { ok: true, value: true };
  }

  updatePetition(id: number, newTitle: string, newThreshold: number): Result<boolean> {
    const petition = this.state.petitions.get(id);
    if (!petition) return { ok: false, value: false };
    if (petition.creator !== this.caller) return { ok: false, value: false };
    if (!newTitle || newTitle.length > 128) return { ok: false, value: false };
    if (newThreshold <= 0 || newThreshold > 1000000) return { ok: false, value: false };
    if (this.state.petitionsByTitle.has(newTitle) && this.state.petitionsByTitle.get(newTitle) !== id) {
      return { ok: false, value: false };
    }

    const updated: Petition = {
      ...petition,
      title: newTitle,
      threshold: newThreshold,
      timestamp: this.blockHeight,
    };
    this.state.petitions.set(id, updated);
    if (petition.title !== newTitle) {
      this.state.petitionsByTitle.delete(petition.title);
      this.state.petitionsByTitle.set(newTitle, id);
    }
    this.state.petitionUpdates.set(id, {
      updateTitle: newTitle,
      updateThreshold: newThreshold,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  checkThresholdMet(petitionId: number): Result<{ met: boolean; count: number }> {
    const petition = this.state.petitions.get(petitionId);
    if (!petition) return { ok: false, value: { met: false, count: 0 } };
    const count = this.state.petitionSignaturesCount.get(petitionId) || 0;
    if (count >= petition.threshold) {
      return { ok: true, value: { met: true, count } };
    }
    return { ok: false, value: { met: false, count } };
  }

  getPetitionCount(): Result<number> {
    return { ok: true, value: this.state.nextPetitionId };
  }

  checkPetitionExistence(title: string): Result<boolean> {
    return { ok: true, value: this.state.petitionsByTitle.has(title) };
  }
}

describe("Petition", () => {
  let contract: PetitionMock;

  beforeEach(() => {
    contract = new PetitionMock();
    contract.reset();
  });

  it("creates a petition successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPetition(
      "Save Environment",
      "Detailed description here...",
      100,
      1000,
      "petition",
      "Environment",
      "Global",
      "STX",
      50,
      500
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const petition = contract.getPetition(0);
    expect(petition?.title).toBe("Save Environment");
    expect(petition?.threshold).toBe(100);
    expect(petition?.deadline).toBe(1000);
    expect(petition?.petitionType).toBe("petition");
    expect(petition?.category).toBe("Environment");
    expect(petition?.location).toBe("Global");
    expect(petition?.currency).toBe("STX");
    expect(petition?.minSupport).toBe(50);
    expect(petition?.maxSupport).toBe(500);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate petition titles", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Save Environment",
      "Detailed description here...",
      100,
      1000,
      "petition",
      "Environment",
      "Global",
      "STX",
      50,
      500
    );
    const result = contract.createPetition(
      "Save Environment",
      "Another description",
      200,
      2000,
      "endorsement",
      "Climate",
      "Local",
      "BTC",
      100,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PETITION_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const result = contract.createPetition(
      "Test Petition",
      "Description",
      50,
      500,
      "proposal",
      "Test",
      "TestLoc",
      "USD",
      10,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("adds a signature successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Save Environment",
      "Detailed description here...",
      100,
      1000,
      "petition",
      "Environment",
      "Global",
      "STX",
      50,
      500
    );
    contract.blockHeight = 500;
    const sigBuffer = Buffer.from("mock-signature", "hex");
    const result = contract.addSignature(0, sigBuffer, 123, 600);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("rejects adding signature after deadline", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Save Environment",
      "Detailed description here...",
      100,
      1000,
      "petition",
      "Environment",
      "Global",
      "STX",
      50,
      500
    );
    contract.blockHeight = 1001;
    const sigBuffer = Buffer.from("mock-signature", "hex");
    const result = contract.addSignature(0, sigBuffer, 123, 1002);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DEADLINE_PASSED);
  });

  it("rejects duplicate signature", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Save Environment",
      "Detailed description here...",
      100,
      1000,
      "petition",
      "Environment",
      "Global",
      "STX",
      50,
      500
    );
    contract.blockHeight = 500;
    const sigBuffer = Buffer.from("mock-signature", "hex");
    contract.addSignature(0, sigBuffer, 123, 600);
    const result = contract.addSignature(0, sigBuffer, 124, 700);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("updates a petition successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Old Petition",
      "Old description",
      100,
      1000,
      "petition",
      "OldCat",
      "OldLoc",
      "STX",
      50,
      500
    );
    const result = contract.updatePetition(0, "New Petition", 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const petition = contract.getPetition(0);
    expect(petition?.title).toBe("New Petition");
    expect(petition?.threshold).toBe(200);
  });

  it("rejects update for non-existent petition", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updatePetition(99, "New Petition", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-creator", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Test Petition",
      "Description",
      50,
      500,
      "proposal",
      "Test",
      "TestLoc",
      "USD",
      10,
      200
    );
    contract.caller = "ST3FAKE";
    const result = contract.updatePetition(0, "New Petition", 100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("checks threshold met successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Threshold Test",
      "Description",
      5,
      1000,
      "petition",
      "Test",
      "Loc",
      "STX",
      1,
      10
    );
    contract.blockHeight = 500;
    const sigBuffer = Buffer.from("mock-signature", "hex");
    for (let i = 0; i < 6; i++) {
      contract.caller = `ST${i}TEST`;
      contract.addSignature(0, sigBuffer, i + 1, 600);
    }
    const result = contract.checkThresholdMet(0);
    expect(result.ok).toBe(true);
    expect(result.value.met).toBe(true);
    expect(result.value.count).toBe(6);
  });

  it("rejects threshold not met", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Threshold Fail",
      "Description",
      10,
      1000,
      "petition",
      "Test",
      "Loc",
      "STX",
      1,
      10
    );
    contract.blockHeight = 500;
    const sigBuffer = Buffer.from("mock-signature", "hex");
    for (let i = 0; i < 5; i++) {
      contract.caller = `ST${i}TEST`;
      contract.addSignature(0, sigBuffer, i + 1, 600);
    }
    const result = contract.checkThresholdMet(0);
    expect(result.ok).toBe(false);
    expect(result.value.met).toBe(false);
    expect(result.value.count).toBe(5);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(1000);
    contract.createPetition(
      "Fee Test",
      "Description",
      50,
      500,
      "proposal",
      "Test",
      "Loc",
      "USD",
      10,
      200
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects creation fee change without authority contract", () => {
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct petition count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Petition1",
      "Desc1",
      50,
      500,
      "petition",
      "Cat1",
      "Loc1",
      "STX",
      10,
      200
    );
    contract.createPetition(
      "Petition2",
      "Desc2",
      100,
      1000,
      "endorsement",
      "Cat2",
      "Loc2",
      "BTC",
      20,
      400
    );
    const result = contract.getPetitionCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks petition existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Existing Petition",
      "Description",
      50,
      500,
      "proposal",
      "Test",
      "TestLoc",
      "USD",
      10,
      200
    );
    const result = contract.checkPetitionExistence("Existing Petition");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkPetitionExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects petition creation with invalid type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPetition(
      "Invalid Type",
      "Description",
      50,
      500,
      "invalid",
      "Test",
      "Loc",
      "STX",
      10,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PETITION_TYPE);
  });

  it("rejects petition creation with empty title", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPetition(
      "",
      "Description",
      50,
      500,
      "petition",
      "Test",
      "Loc",
      "STX",
      10,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("rejects petition creation with max petitions exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxPetitions = 1;
    contract.createPetition(
      "First",
      "Desc",
      50,
      500,
      "petition",
      "Cat",
      "Loc",
      "STX",
      10,
      200
    );
    const result = contract.createPetition(
      "Second",
      "Desc2",
      100,
      1000,
      "endorsement",
      "Cat2",
      "Loc2",
      "BTC",
      20,
      400
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

  it("rejects signature with invalid nonce", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPetition(
      "Sig Test",
      "Description",
      1,
      1000,
      "petition",
      "Test",
      "Loc",
      "STX",
      1,
      10
    );
    contract.blockHeight = 500;
    const sigBuffer = Buffer.from("mock-signature", "hex");
    const result = contract.addSignature(0, sigBuffer, 0, 600);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SIGNATURE);
  });
});