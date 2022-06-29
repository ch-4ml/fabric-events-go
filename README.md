# Asset Transfer Events Sample

이 예제에서는 체인코드 이벤트를 보내고 받는 과정, 블록 이벤트를 받는 과정을 애플리케이션을 통해 보여줍니다. 먼저, 체인코드 작성 시 트랜잭션에 이벤트 데이터를 추가하도록 설정합니다. 그러면 해당 체인코드가 포함된 트랜잭션이 원장에 커밋될 때 설정한 체인코드 이벤트가 발생합니다. 블록 이벤트는 블록이 원장에 커밋될 때 발생하며 해당 블록 내 모든 트랜잭션의 세부 정보를 포함합니다.

> 채널 별 이벤트 서비스에 대한 자세한 내용은 Fabric Docs의
> [Channel-based event service](https://hyperledger-fabric.readthedocs.io/en/latest/peer_event_services.html) 페이지를 참조하세요.

## About the Sample

- 이 예제는 Hyperledger Fabric 2.2.3 버전에서 정상적으로 동작합니다.
- 2.2 버전 fabric-samples의 `asset-transfer-event` 예제의 체인코드를 go 언어로 porting 하였습니다.
- 2.2 버전 fabric-samples의 `asset-transfer-basic` 예제와 유사하게 동작합니다.
- 자산 생성, 업데이트, 삭제, 소유권 이전을 수행하는 동안 이벤트 송수신 과정을 보여줍니다.

### Application

이 애플리케이션에서는 두 가지 유형의 event listener를 사용합니다.

1. Contract Listener: 특정 contract의 (체인코드) 이벤트를 수신합니다.

- 애플리케이션에 contract listener를 등록하는 방법을 다룹니다.
- 체인코드 이벤트로부터 체인코드 이벤트의 이름과 값을 가져오는 방법을 다룹니다.
- 체인코드 이벤트로부터 트랜잭션 정보와 블록의 정보를 가져오는 방법을 다룹니다.

2. Block Listener: 블록 수준의 이벤트를 수신하고, private data 이벤트를 파싱합니다.

- 모든 블록 이벤트를 감지하기 위한 block listener를 등록하는 방법을 다룹니다.
- 블록 이벤트로부터 트랜잭션과 블록의 정보를 가져오는 방법을 다룹니다.
- 블록 이벤트로부터 트랜잭션과 관련된 private data를 가져오는 방법을 다룹니다.
- 모든 블록 이벤트에서 private data collection의 상세 정보를 가져오는 방법을 다룹니다.
- 이 섹션에서는 커밋 이벤트를 수신하지 않는 listener를 사용하여 게이트웨이에 연결하는 방법도 다룹니다.
- 기본적으로 submitTransaction 함수는 연결된 모든 피어로부터 성공적인 commit 이벤트가 수신될 때까지 기다립니다.
- 커밋 이벤트를 수신하지 않도록 설정하면 submitTransaction 함수가 트랜잭션을 성공적으로 전송한 후 즉시 반환됩니다.

애플리케이션을 실행하는 동안 `application/app.js` 파일의 주석과 콘솔 출력을 참고하세요.

애플리케이션은 다음과 같은 순서로 동작합니다.

- 체인코드 호출 (콘솔 출력은 다음과 같습니다. `--> Submit Transaction or --> Evaluate`)
- 애플리케이션에서 이벤트 수신 (콘솔 출력은 다음과 같습니다. `<-- Contract Event Received: or <-- Block Event Received`)

Listener는 이벤트를 <b>비동기</b>적으로 수신합니다. 이벤트는 애플리케이션 코드가 트랜잭션을 전송한 후(또는 변경 사항이 원장에 커밋된 후) 다른 활동 중에 수신될 수 있습니다.

### Smart Contract

`chaincode-go` 디렉토리에 구현된 체인코드는 다음과 같은 함수들로 구성되어 있습니다.

- CreateAsset
- ReadAsset
- UpdateAsset
- DeleteAsset
- TransferAsset

스마트 컨트랙트에 의해 구현된 `asset-transfer`는 이벤트 송수신을 시연할 목적으로 작성되어 소유권 유효성 검사 없이 단순하게 구성되어 있습니다.

## Running the sample

`fabric-samples`의 `test-network`를 사용하여 예제를 배포하고 실행합니다. 다음 단계를 순서대로 수행하십시오.

- 이 repository의 파일을 모두 clone 또는 download하세요.

```
git clone https://github.com/ch-4ml/fabric-events-go.git
```

- Download한 파일을 모두 로컬 환경에 구성된 `fabric-samples/asset-transfer-events/` 디렉토리에 복사하세요.
- 아래 코드는 `fabric-samples` 디렉토리가 사용자의 `home` 디렉토리 (`/home/[username]`)에 구성되어 있음을 전제합니다.

```
.../fabric-events-go $ cp -r . ~/fabric-samples/asset-transfer-events/
```

- 네트워크를 구성하고 체인코드를 배포합니다.

```
~/fabric-samples/asset-transfer-events/application $ ./up.sh
```

- 애플리케이션을 실행합니다.

```
~/fabric-samples/asset-transfer-events/application $ npm install
~/fabric-samples/asset-transfer-events/application $ node app.js
```

## Clean up

- 테스트를 완료하면 네트워크를 종료할 수 있습니다.
- 다음 명령은 구동한 네트워크의 모든 컴포넌트를 제거하고 생성한 데이터를 삭제합니다.
- 지갑을 삭제하는 명령을 포함하고 있습니다.

```
~/fabric-samples/asset-transfer-events/application $ ./down.sh
```
