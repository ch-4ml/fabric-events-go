/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * 자산을 생성, 수정, 전송, 삭제 시 발생하는 이벤트를 표시하는 응용 프로그램입니다.

 *   -- Contract listener를 등록하여 체인코드 이벤트를 수신하는 방법을 다룹니다.
 *   -- 체인코드 이벤트로부터 체인코드 이벤트의 이름과 값을 가져오는 방법을 다룹니다.
 *   -- 체인코드 이벤트로부터 트랜잭션과 블록의 정보를 가져오는 방법을 다룹니다.
 
 *   -- Block listener를 등록하여 모든 블록 이벤트를 수신하는 방법을 다룹니다.
 *   -- 모든 블록 이벤트로부터 트랜잭션과 블록의 정보를 가져오는 방법을 다룹니다.
 *   -- 트랜잭션과 관련된 private data를 가져오기 위한 block listener 설정 방법을 다룹니다.
 *   -- 모든 블록 이벤트로부터 private data를 가져오는 방법을 다룹니다.
 
 *   -- Listener는 언제든지 이벤트를 수신할 수 있습니다.
 *   -- 이벤트는 transaction commit, block commit 등 원장 변경의 원인이 되는 작업 후에 비동기로 발생합니다.
 *   -- Transaction commit event를 사용하지 않는 게이트웨이에 연결하는 방법을 다룹니다.
 *   -- 이 기능은 응용 프로그램이 peer가 블록을 커밋하고 응용 프로그램에 통보할 때까지 기다릴 필요가 없는 경우 유용할 수 있습니다.
 
 * 현재 SDK 실행 로그는 debug.log 파일에 저장됩니다.
 * SDK의 작동을 실시간으로 확인하려면 이 응용 프로그램을 실행하기 전에 콘솔에 로그가 표시되도록 설정하세요.
 *        export HFC_LOGGING='{"debug":"console"}'

 * SDK가 피어 이벤트 서비스와 상호작용하는 방법
 * https://hyperledger-fabric.readthedocs.io/en/latest/peer_event_services.html
 *
 * 자세한 Node SDK 사용 방법
 * https://hyperledger.github.io/fabric-sdk-node/release-2.2/module-fabric-network.html
 */

// use this to set logging, must be set before the require('fabric-network');
process.env.HFC_LOGGING = '{"debug": "./debug.log"}';

const { Gateway, Wallets } = require('fabric-network');
const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');

const channelName = 'mychannel';
const chaincodeName = 'events';

const org1 = 'Org1MSP';
const Org1UserId = 'appUser1';

const RED = '\x1b[31m\n';
const GREEN = '\x1b[32m\n';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

/**
 * Perform a sleep -- asynchronous wait
 * @param ms the time in milliseconds to sleep for
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 피어와 애플리케이션이 상호작용할 게이트웨이를 생성하는 함수
// 미리 만들어둔 모듈을 이용하여(line 44-45) 네트워크 연결 정보 전달, 지갑 및 인증정보 생성 기능 등 수행
async function initGatewayForOrg1(useCommitEvents) {
  console.log(`${GREEN}--> Fabric client user & Gateway init: Using Org1 identity to Org1 Peer${RESET}`);

  const ccpOrg1 = buildCCPOrg1();
  const caOrg1Client = buildCAClient(FabricCAServices, ccpOrg1, 'ca.org1.example.com');

  const walletPathOrg1 = path.join(__dirname, 'wallet', 'org1');
  const walletOrg1 = await buildWallet(Wallets, walletPathOrg1);

  await enrollAdmin(caOrg1Client, walletOrg1, org1);
  await registerAndEnrollUser(caOrg1Client, walletOrg1, org1, Org1UserId, 'org1.department1');

  try {
    // Create a new gateway for connecting to Org's peer node.
    const gatewayOrg1 = new Gateway();

    // 전달받은 인자 useCommitEvents에 따라 transaction commit event 사용 여부를 결정
    if (useCommitEvents) {
      await gatewayOrg1.connect(ccpOrg1, {
        wallet: walletOrg1,
        identity: Org1UserId,
        discovery: { enabled: true, asLocalhost: true }
        // eventHandlerOptions: EventStrategies.PREFER_MSPID_SCOPE_ANYFORTX  // Default
        // 클라이언트 ID가 포함된 organization의 모든 peer에서 트랜잭션 커밋 이벤트를 수신
        // 클라이언트 ID가 포함된 organization에 peer가 존재하지 않는 경우 네트워크의 모든 peer에서 트랜잭션 커밋 이벤트를 수신
      });
    } else {
      await gatewayOrg1.connect(ccpOrg1, {
        wallet: walletOrg1,
        identity: Org1UserId,
        discovery: { enabled: true, asLocalhost: true },
        eventHandlerOptions: EventStrategies.NONE
      });
    }

    return gatewayOrg1;
  } catch (error) {
    console.error(`Error in connecting to gateway for Org1: ${error}`);
    process.exit(1);
  }
}

// 현재 등록되어 있는 자산 정보가 올바른지 검사하는 함수
function checkAsset(org, resultBuffer, color, size, owner, appraisedValue, price) {
  console.log(`${GREEN}<-- Query results from ${org}${RESET}`);

  let asset;
  if (resultBuffer) {
    asset = JSON.parse(resultBuffer.toString('utf8'));
  } else {
    console.log(`${RED}*** Failed to read asset${RESET}`);
  }
  console.log(`*** verify asset ${asset.ID}`);

  if (asset) {
    if (asset.Color === color) {
      console.log(`*** asset ${asset.ID} has color ${asset.Color}`);
    } else {
      console.log(`${RED}*** asset ${asset.ID} has color of ${asset.Color}${RESET}`);
    }
    if (asset.Size === size) {
      console.log(`*** asset ${asset.ID} has size ${asset.Size}`);
    } else {
      console.log(`${RED}*** Failed size check from ${org} - asset ${asset.ID} has size of ${asset.Size}${RESET}`);
    }
    if (asset.Owner === owner) {
      console.log(`*** asset ${asset.ID} owned by ${asset.Owner}`);
    } else {
      console.log(`${RED}*** Failed owner check from ${org} - asset ${asset.ID} owned by ${asset.Owner}${RESET}`);
    }
    if (asset.AppraisedValue === appraisedValue) {
      console.log(`*** asset ${asset.ID} has appraised value ${asset.AppraisedValue}`);
    } else {
      console.log(
        `${RED}*** Failed appraised value check from ${org} - asset ${asset.ID} has appraised value of ${asset.AppraisedValue}${RESET}`
      );
    }
    if (price) {
      if (asset.asset_properties && asset.asset_properties.Price === price) {
        console.log(`*** asset ${asset.ID} has price ${asset.asset_properties.Price}`);
      } else {
        console.log(
          `${RED}*** Failed price check from ${org} - asset ${asset.ID} has price of ${asset.asset_properties.Price}${RESET}`
        );
      }
    }
  }
}

// Contract listener, block listener를 통해 수신한 이벤트에서 트랜잭션 정보를 가져오는 함수
function showTransactionData(transactionData) {
  const creator = transactionData.actions[0].header.creator;
  console.log(`    - submitted by: ${creator.mspid}-${creator.id_bytes.toString('hex')}`);
  for (const endorsement of transactionData.actions[0].payload.action.endorsements) {
    console.log(`    - endorsed by: ${endorsement.endorser.mspid}-${endorsement.endorser.id_bytes.toString('hex')}`);
  }
  const chaincode = transactionData.actions[0].payload.chaincode_proposal_payload.input.chaincode_spec;
  console.log(`    - chaincode:${chaincode.chaincode_id.name}`);
  console.log(`    - function:${chaincode.input.args[0].toString()}`);
  for (let x = 1; x < chaincode.input.args.length; x++) {
    console.log(`    - arg:${chaincode.input.args[x].toString()}`);
  }
}

async function main() {
  console.log(`${BLUE} **** START ****${RESET}`);
  try {
    let randomNumber = Math.floor(Math.random() * 1000) + 1;
    // use a random key so that we can run multiple times
    let assetKey = `item-${randomNumber}`;

    /** ******* Fabric client init: Using Org1 identity to Org1 Peer ******* */
    const gateway1Org1 = await initGatewayForOrg1(true); // 트랜잭션 커밋 이벤트를 수신하는 게이트웨이
    const gateway2Org1 = await initGatewayForOrg1(); // 트랜잭션 커밋 이벤트를 수신하지 않는 게이트웨이

    try {
      //
      //  - - - - - -  C H A I N C O D E  E V E N T S
      //
      console.log(`${BLUE} **** CHAINCODE EVENTS ****${RESET}`);
      let transaction;
      let listener;
      const network1Org1 = await gateway1Org1.getNetwork(channelName);
      const contract1Org1 = network1Org1.getContract(chaincodeName);

      try {
        // Contract listener 정의
        listener = async (event) => {
          // payload: 체인코드에서 등록한 event에서 전달하는 값
          // byte 데이터이기 때문에 역직렬화(unmarshal, parse, ...) 필요
          // 예제에서는 체인코드 event를 통해 항상 현재 처리중인 자산의 정보를 전달하고 있음
          const asset = JSON.parse(event.payload.toString());
          console.log(`${GREEN}<-- Contract Event Received: ${event.eventName} - ${JSON.stringify(asset)}${RESET}`);
          // show the information available with the event
          console.log(`*** Event: ${event.eventName}:${asset.ID}`);
          // 체인코드 event를 발생시킨 트랜잭션 정보에 접근할 수 있음
          const eventTransaction = event.getTransactionEvent();
          console.log(`*** transaction: ${eventTransaction.transactionId} status:${eventTransaction.status}`);
          showTransactionData(eventTransaction.transactionData);
          // 이 트랜잭션을 포함하는 블록 정보에 접근할 수 있음
          const eventBlock = eventTransaction.getBlockEvent();
          console.log(`*** block: ${eventBlock.blockNumber.toString()}`);
        };
        // Contract listener 등록
        console.log(`${GREEN}--> Start contract event stream to peer in Org1${RESET}`);
        await contract1Org1.addContractListener(listener);
      } catch (eventError) {
        console.log(`${RED}<-- Failed: Setup contract events - ${eventError}${RESET}`);
      }

      try {
        // C R E A T E
        console.log(`${GREEN}--> Submit Transaction: CreateAsset, ${assetKey} owned by Sam${RESET}`);
        transaction = contract1Org1.createTransaction('CreateAsset');
        await transaction.submit(assetKey, 'blue', '10', 'Sam', '100');
        console.log(`${GREEN}<-- Submit CreateAsset Result: committed, asset ${assetKey}${RESET}`);
      } catch (createError) {
        console.log(`${RED}<-- Submit Failed: CreateAsset - ${createError}${RESET}`);
      }
      try {
        // R E A D
        console.log(`${GREEN}--> Evaluate: ReadAsset, - ${assetKey} should be owned by Sam${RESET}`);
        const resultBuffer = await contract1Org1.evaluateTransaction('ReadAsset', assetKey);
        checkAsset(org1, resultBuffer, 'blue', '10', 'Sam', '100');
      } catch (readError) {
        console.log(`${RED}<-- Failed: ReadAsset - ${readError}${RESET}`);
      }

      try {
        // U P D A T E
        console.log(`${GREEN}--> Submit Transaction: UpdateAsset ${assetKey} update appraised value to 200`);
        transaction = contract1Org1.createTransaction('UpdateAsset');
        await transaction.submit(assetKey, 'blue', '10', 'Sam', '200');
        console.log(`${GREEN}<-- Submit UpdateAsset Result: committed, asset ${assetKey}${RESET}`);
      } catch (updateError) {
        console.log(`${RED}<-- Failed: UpdateAsset - ${updateError}${RESET}`);
      }
      try {
        // R E A D
        console.log(`${GREEN}--> Evaluate: ReadAsset, - ${assetKey} should now have appraised value of 200${RESET}`);
        const resultBuffer = await contract1Org1.evaluateTransaction('ReadAsset', assetKey);
        checkAsset(org1, resultBuffer, 'blue', '10', 'Sam', '200');
      } catch (readError) {
        console.log(`${RED}<-- Failed: ReadAsset - ${readError}${RESET}`);
      }

      try {
        // T R A N S F E R
        console.log(`${GREEN}--> Submit Transaction: TransferAsset ${assetKey} to Mary`);
        transaction = contract1Org1.createTransaction('TransferAsset');
        await transaction.submit(assetKey, 'Mary');
        console.log(`${GREEN}<-- Submit TransferAsset Result: committed, asset ${assetKey}${RESET}`);
      } catch (transferError) {
        console.log(`${RED}<-- Failed: TransferAsset - ${transferError}${RESET}`);
      }
      try {
        // R E A D
        console.log(`${GREEN}--> Evaluate: ReadAsset, - ${assetKey} should now be owned by Mary${RESET}`);
        const resultBuffer = await contract1Org1.evaluateTransaction('ReadAsset', assetKey);
        checkAsset(org1, resultBuffer, 'blue', '10', 'Mary', '200');
      } catch (readError) {
        console.log(`${RED}<-- Failed: ReadAsset - ${readError}${RESET}`);
      }

      try {
        // D E L E T E
        console.log(`${GREEN}--> Submit Transaction: DeleteAsset ${assetKey}`);
        transaction = contract1Org1.createTransaction('DeleteAsset');
        await transaction.submit(assetKey);
        console.log(`${GREEN}<-- Submit DeleteAsset Result: committed, asset ${assetKey}${RESET}`);
      } catch (deleteError) {
        console.log(`${RED}<-- Failed: DeleteAsset - ${deleteError}${RESET}`);
        if (deleteError.toString().includes('ENDORSEMENT_POLICY_FAILURE')) {
          console.log(
            `${RED}Be sure that chaincode was deployed with the endorsement policy "OR('Org1MSP.peer','Org2MSP.peer')"${RESET}`
          );
        }
      }
      try {
        // R E A D
        console.log(`${GREEN}--> Evaluate: ReadAsset, - ${assetKey} should now be deleted${RESET}`);
        const resultBuffer = await contract1Org1.evaluateTransaction('ReadAsset', assetKey);
        checkAsset(org1, resultBuffer, 'blue', '10', 'Mary', '200');
        console.log(`${RED}<-- Failed: ReadAsset - should not have read this asset${RESET}`);
      } catch (readError) {
        console.log(`${GREEN}<-- Success: ReadAsset - ${readError}${RESET}`);
      }

      // all done with this listener
      contract1Org1.removeContractListener(listener);

      //
      //  - - - - - -  B L O C K  E V E N T S  with  P R I V A T E  D A T A
      //
      console.log(`${BLUE} **** BLOCK EVENTS with PRIVATE DATA ****${RESET}`);
      const network2Org1 = await gateway2Org1.getNetwork(channelName);
      const contract2Org1 = network2Org1.getContract(chaincodeName);

      randomNumber = Math.floor(Math.random() * 1000) + 1;
      assetKey = `item-${randomNumber}`;

      let firstBlock = true; // simple indicator to track blocks

      try {
        let listener;

        // Block listener 정의
        listener = async (event) => {
          // Genesis block 이후 새로운 블록이 생성될 때마다 발생하는 이벤트를 감지
          if (firstBlock) {
            console.log(
              `${GREEN}<-- Block Event Received - block number: ${event.blockNumber.toString()}` +
                '\n### Note:' +
                '\n    This block event represents the current top block of the ledger.' +
                `\n    All block events after this one are events that represent new blocks added to the ledger${RESET}`
            );
            firstBlock = false;
          } else {
            console.log(`${GREEN}<-- Block Event Received - block number: ${event.blockNumber.toString()}${RESET}`);
          }
          // 새로 만들어진 블록에 포함된 트랜잭션 이벤트들에 접근할 수 있음
          const transEvents = event.getTransactionEvents();
          for (const transEvent of transEvents) {
            console.log(`*** transaction event: ${transEvent.transactionId}`);
            if (transEvent.privateData) {
              for (const namespace of transEvent.privateData.ns_pvt_rwset) {
                console.log(`    - private data: ${namespace.namespace}`);
                for (const collection of namespace.collection_pvt_rwset) {
                  console.log(`     - collection: ${collection.collection_name}`);
                  if (collection.rwset.reads) {
                    for (const read of collection.rwset.reads) {
                      console.log(
                        `       - read set - ${BLUE}key:${RESET} ${read.key}  ${BLUE}value:${read.value.toString()}`
                      );
                    }
                  }
                  if (collection.rwset.writes) {
                    for (const write of collection.rwset.writes) {
                      console.log(
                        `      - write set - ${BLUE}key:${RESET}${write.key} ${BLUE}is_delete:${RESET}${
                          write.is_delete
                        } ${BLUE}value:${RESET}${write.value.toString()}`
                      );
                    }
                  }
                }
              }
            }
            if (transEvent.transactionData) {
              showTransactionData(transEvent.transactionData);
            }
          }
        };
        // Block listener 등록
        // Private data에 접근할 수 있도록 등록함
        console.log(`${GREEN}--> Start private data block event stream to peer in Org1${RESET}`);
        await network2Org1.addBlockListener(listener, { type: 'private' });
      } catch (eventError) {
        console.log(`${RED}<-- Failed: Setup block events - ${eventError}${RESET}`);
      }

      try {
        // C R E A T E
        console.log(`${GREEN}--> Submit Transaction: CreateAsset, ${assetKey} owned by Sam${RESET}`);
        transaction = contract2Org1.createTransaction('CreateAsset');

        // create the private data with salt and assign to the transaction
        const randomNumber = Math.floor(Math.random() * 100) + 1;
        const asset_properties = {
          object_type: 'asset_properties',
          asset_id: assetKey,
          Price: '90',
          salt: Buffer.from(randomNumber.toString()).toString('hex')
        };
        const asset_properties_string = JSON.stringify(asset_properties);
        transaction.setTransient({
          asset_properties: Buffer.from(asset_properties_string)
        });
        // 트랜잭션에 private data를 추가하는 경우 private data를 저장할 organization에만
        // 이 정보를 전송해야 함. 그렇지 않으면 endorsement policy failure 발생
        transaction.setEndorsingOrganizations(org1);

        // Endorse, commit: private data(transient data)가 peer의 implicit collection에 저장됨
        // implicit collection은 체인코드에 정의되어 있음
        await transaction.submit(assetKey, 'blue', '10', 'Sam', '100');
        console.log(`${GREEN}<-- Submit CreateAsset Result: committed, asset ${assetKey}${RESET}`);
      } catch (createError) {
        console.log(`${RED}<-- Failed: CreateAsset - ${createError}${RESET}`);
      }
      await sleep(5000); // need to wait for event to be committed
      try {
        // R E A D
        console.log(`${GREEN}--> Evaluate: ReadAsset, - ${assetKey} should be owned by Sam${RESET}`);
        const resultBuffer = await contract2Org1.evaluateTransaction('ReadAsset', assetKey);
        checkAsset(org1, resultBuffer, 'blue', '10', 'Sam', '100', '90');
      } catch (readError) {
        console.log(`${RED}<-- Failed: ReadAsset - ${readError}${RESET}`);
      }

      try {
        // U P D A T E
        console.log(`${GREEN}--> Submit Transaction: UpdateAsset ${assetKey} update appraised value to 200`);
        transaction = contract2Org1.createTransaction('UpdateAsset');

        // update the private data with new salt and assign to the transaction
        const randomNumber = Math.floor(Math.random() * 100) + 1;
        const asset_properties = {
          object_type: 'asset_properties',
          asset_id: assetKey,
          Price: '90',
          salt: Buffer.from(randomNumber.toString()).toString('hex')
        };
        const asset_properties_string = JSON.stringify(asset_properties);
        transaction.setTransient({
          asset_properties: Buffer.from(asset_properties_string)
        });
        transaction.setEndorsingOrganizations(org1);

        await transaction.submit(assetKey, 'blue', '10', 'Sam', '200');
        console.log(`${GREEN}<-- Submit UpdateAsset Result: committed, asset ${assetKey}${RESET}`);
      } catch (updateError) {
        console.log(`${RED}<-- Failed: UpdateAsset - ${updateError}${RESET}`);
      }
      await sleep(5000); // need to wait for event to be committed
      try {
        // R E A D
        console.log(`${GREEN}--> Evaluate: ReadAsset, - ${assetKey} should now have appraised value of 200${RESET}`);
        const resultBuffer = await contract2Org1.evaluateTransaction('ReadAsset', assetKey);
        checkAsset(org1, resultBuffer, 'blue', '10', 'Sam', '200', '90');
      } catch (readError) {
        console.log(`${RED}<-- Failed: ReadAsset - ${readError}${RESET}`);
      }

      try {
        // T R A N S F E R
        console.log(`${GREEN}--> Submit Transaction: TransferAsset ${assetKey} to Mary`);
        transaction = contract2Org1.createTransaction('TransferAsset');

        // update the private data with new salt and assign to the transaction
        const randomNumber = Math.floor(Math.random() * 100) + 1;
        const asset_properties = {
          object_type: 'asset_properties',
          asset_id: assetKey,
          Price: '180',
          salt: Buffer.from(randomNumber.toString()).toString('hex')
        };
        const asset_properties_string = JSON.stringify(asset_properties);
        transaction.setTransient({
          asset_properties: Buffer.from(asset_properties_string)
        });
        transaction.setEndorsingOrganizations(org1);

        await transaction.submit(assetKey, 'Mary');
        console.log(`${GREEN}<-- Submit TransferAsset Result: committed, asset ${assetKey}${RESET}`);
      } catch (transferError) {
        console.log(`${RED}<-- Failed: TransferAsset - ${transferError}${RESET}`);
      }
      await sleep(5000); // need to wait for event to be committed
      try {
        // R E A D
        console.log(`${GREEN}--> Evaluate: ReadAsset, - ${assetKey} should now be owned by Mary${RESET}`);
        const resultBuffer = await contract2Org1.evaluateTransaction('ReadAsset', assetKey);
        checkAsset(org1, resultBuffer, 'blue', '10', 'Mary', '200', '180');
      } catch (readError) {
        console.log(`${RED}<-- Failed: ReadAsset - ${readError}${RESET}`);
      }

      try {
        // D E L E T E
        console.log(`${GREEN}--> Submit Transaction: DeleteAsset ${assetKey}`);
        transaction = contract2Org1.createTransaction('DeleteAsset');
        await transaction.submit(assetKey);
        console.log(`${GREEN}<-- Submit DeleteAsset Result: committed, asset ${assetKey}${RESET}`);
      } catch (deleteError) {
        console.log(`${RED}<-- Failed: DeleteAsset - ${deleteError}${RESET}`);
      }
      await sleep(5000); // need to wait for event to be committed
      try {
        // R E A D
        console.log(`${GREEN}--> Evaluate: ReadAsset, - ${assetKey} should now be deleted${RESET}`);
        const resultBuffer = await contract2Org1.evaluateTransaction('ReadAsset', assetKey);
        checkAsset(org1, resultBuffer, 'blue', '10', 'Mary', '200');
        console.log(`${RED}<-- Failed: ReadAsset - should not have read this asset${RESET}`);
      } catch (readError) {
        console.log(`${GREEN}<-- Success: ReadAsset - ${readError}${RESET}`);
      }

      // all done with this listener
      network2Org1.removeBlockListener(listener);
    } catch (runError) {
      console.error(`Error in transaction: ${runError}`);
      if (runError.stack) {
        console.error(runError.stack);
      }
    }
  } catch (error) {
    console.error(`Error in setup: ${error}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  await sleep(5000);
  console.log(`${BLUE} **** END ****${RESET}`);
  process.exit(0);
}
main();
