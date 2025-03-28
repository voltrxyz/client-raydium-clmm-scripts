import * as fs from "fs";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sendAndConfirmOptimisedTx, setupTokenAccount } from "../utils/helper";
import { BN } from "@coral-xyz/anchor";
import { VoltrClient } from "@voltr/vault-sdk";
import {
  assetMintAddress,
  heliusRpcUrl,
  managerFilePath,
  vaultAddress,
  assetTokenProgram,
  outputMintAddress,
  outputTokenProgram,
  lookupTableAddress,
  useLookupTable,
  increaseLiquidityAssetAmount,
  poolId,
  endPrice,
  startPrice,
  assetTokenOracle,
  outputTokenOracle,
} from "../variables";
import { setupJupiterSwapForDepositStrategy } from "../utils/setup-jupiter-swap";
import { initSdk } from "../utils/raydium-config";
import {
  ApiV3PoolInfoConcentratedItem,
  CLMM_PROGRAM_ID,
  ClmmKeys,
  getPdaPersonalPositionAddress,
  getPdaProtocolPositionAddress,
  getPdaTickArrayAddress,
  TickUtils,
} from "@raydium-io/raydium-sdk-v2";
import { Decimal } from "decimal.js";
import { DISCRIMINATOR, RAYDIUM_ADAPTOR_PROGRAM_ID } from "../constants/global";
import { fetchRaydiumClmmPoolPositionForVault } from "../utils/raydium";

const payerKpFile = fs.readFileSync(managerFilePath, "utf-8");
const payerKpData = JSON.parse(payerKpFile);
const payerSecret = Uint8Array.from(payerKpData);
const payerKp = Keypair.fromSecretKey(payerSecret);
const payer = payerKp.publicKey;

const vault = new PublicKey(vaultAddress);
const vaultAssetMint = new PublicKey(assetMintAddress);
const vaultAssetTokenProgram = new PublicKey(assetTokenProgram);
const vaultAssetOracle = new PublicKey(assetTokenOracle);
const vaultOutputMint = new PublicKey(outputMintAddress);
const vaultOutputTokenProgram = new PublicKey(outputTokenProgram);
const vaultOutputOracle = new PublicKey(outputTokenOracle);

const connection = new Connection(heliusRpcUrl);
const vc = new VoltrClient(connection);
const increaseLiquidityAmount = new BN(increaseLiquidityAssetAmount);

const increaseRaydiumCLMMLiquidity = async () => {
  const raydium = await initSdk();
  const data = await raydium.api.fetchPoolById({ ids: poolId });
  let poolInfo: ApiV3PoolInfoConcentratedItem;
  poolInfo = data[0] as ApiV3PoolInfoConcentratedItem;
  const assetMint = new PublicKey(assetMintAddress);
  const outputMint = new PublicKey(outputMintAddress);

  const [programId, id] = [
    new PublicKey(poolInfo.programId),
    new PublicKey(poolInfo.id),
  ];

  const isAssetToken0 = assetMint.toBuffer() < outputMint.toBuffer();

  let { tick: lowerTick } = TickUtils.getPriceAndTick({
    poolInfo,
    price: new Decimal(startPrice),
    baseIn: isAssetToken0,
  });

  let { tick: upperTick } = TickUtils.getPriceAndTick({
    poolInfo,
    price: new Decimal(endPrice),
    baseIn: isAssetToken0,
  });

  [lowerTick, upperTick] =
    lowerTick > upperTick ? [upperTick, lowerTick] : [lowerTick, upperTick];

  const position = await fetchRaydiumClmmPoolPositionForVault(
    poolId,
    vault,
    connection,
    lowerTick,
    upperTick
  );

  if (!position) throw new Error("Position not yet created");

  const nftMintAccount = position?.nftMint;

  const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
    lowerTick,
    poolInfo.config.tickSpacing
  );
  const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
    upperTick,
    poolInfo.config.tickSpacing
  );

  const { publicKey: tickArrayLower } = getPdaTickArrayAddress(
    programId,
    id,
    tickArrayLowerStartIndex
  );
  const { publicKey: tickArrayUpper } = getPdaTickArrayAddress(
    programId,
    id,
    tickArrayUpperStartIndex
  );

  const { vaultStrategyAuth } = vc.findVaultStrategyAddresses(
    vault,
    nftMintAccount
  );

  const positionNftAccount = getAssociatedTokenAddressSync(
    nftMintAccount,
    vaultStrategyAuth,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  const { publicKey: personalPosition } = getPdaPersonalPositionAddress(
    programId,
    nftMintAccount
  );
  const { publicKey: protocolPosition } = getPdaProtocolPositionAddress(
    programId,
    id,
    lowerTick,
    upperTick
  );

  let transactionIxs: TransactionInstruction[] = [];

  const vaultStrategyAssetAta = await setupTokenAccount(
    connection,
    payer,
    vaultAssetMint,
    vaultStrategyAuth,
    transactionIxs,
    vaultAssetTokenProgram
  );

  const vaultStrategyOutputAta = await setupTokenAccount(
    connection,
    payer,
    vaultOutputMint,
    vaultStrategyAuth,
    transactionIxs,
    vaultOutputTokenProgram
  );

  const poolKeysList = await raydium.api.fetchPoolKeysById({
    idList: [poolId],
  });
  const poolKeys: ClmmKeys = poolKeysList[0] as ClmmKeys;

  const raydiumVaultAssetAta = isAssetToken0
    ? new PublicKey(poolKeys.vault.A)
    : new PublicKey(poolKeys.vault.B);
  const raydiumVaultOutputAta = isAssetToken0
    ? new PublicKey(poolKeys.vault.B)
    : new PublicKey(poolKeys.vault.A);

  // Prepare the remaining accounts
  const remainingAccounts = [
    { pubkey: CLMM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: positionNftAccount, isSigner: false, isWritable: false },
    { pubkey: id, isSigner: false, isWritable: true },
    { pubkey: protocolPosition, isSigner: false, isWritable: true },
    { pubkey: personalPosition, isSigner: false, isWritable: true },
    { pubkey: tickArrayLower, isSigner: false, isWritable: true },
    { pubkey: tickArrayUpper, isSigner: false, isWritable: true },
    { pubkey: vaultStrategyOutputAta, isSigner: false, isWritable: true },
    { pubkey: raydiumVaultAssetAta, isSigner: false, isWritable: true },
    { pubkey: raydiumVaultOutputAta, isSigner: false, isWritable: true },
    { pubkey: vaultOutputMint, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: vaultAssetOracle, isSigner: false, isWritable: false },
    { pubkey: vaultOutputOracle, isSigner: false, isWritable: false },
  ];

  const baseAddressLookupTableAddresses: string[] = [];

  if (poolKeys.lookupTableAccount)
    baseAddressLookupTableAddresses.push(poolKeys.lookupTableAccount);

  if (useLookupTable) baseAddressLookupTableAddresses.push(lookupTableAddress);

  const { additionalArgs, addressLookupTableAccounts } =
    await setupJupiterSwapForDepositStrategy(
      connection,
      increaseLiquidityAmount.mul(new BN(10_000)).div(new BN(10_000 * 2 + 10)),
      payer,
      vaultStrategyAuth,
      Buffer.from([]),
      remainingAccounts,
      transactionIxs,
      baseAddressLookupTableAddresses
    );

  const createDepositStrategyIx = await vc.createDepositStrategyIx(
    {
      depositAmount: increaseLiquidityAmount,
      instructionDiscriminator: Buffer.from(
        DISCRIMINATOR.INCREASE_CLMM_LIQUIDITY
      ),
      additionalArgs,
    },
    {
      manager: payer,
      vault,
      vaultAssetMint,
      assetTokenProgram: new PublicKey(assetTokenProgram),
      strategy: nftMintAccount,
      adaptorProgram: new PublicKey(RAYDIUM_ADAPTOR_PROGRAM_ID),
      remainingAccounts,
    }
  );

  transactionIxs.push(createDepositStrategyIx);

  const txSig = await sendAndConfirmOptimisedTx(
    transactionIxs,
    heliusRpcUrl,
    payerKp,
    [],
    addressLookupTableAccounts
  );
  console.log("Raydium CLMM liquidity increased with signature:", txSig);
};

const main = async () => {
  await increaseRaydiumCLMMLiquidity();
};

main();
