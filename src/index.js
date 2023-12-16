import { cosmwasm, FEES, getSigningOsmosisClient, getSigningCosmwasmClient } from "osmojs";
const { executeContract } = cosmwasm.wasm.v1.MessageComposer.withTypeUrl;
const { MsgExecuteContract } = cosmwasm.wasm.v1;

const restUrl = "https://rest-osmosis.ecostake.com";

navigator.serviceWorker.register("service-worker.js");


(async () => {
  // waits for window.keplr to exist (if extension is installed, enabled and injecting its content script)
  await getKeplr();
  // ok keplr is present... enable chain
  await keplr_connectOsmosis();

  // check URL for id field, and set value of orderId input
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');
  if (orderId) {
    document.getElementById("orderId").value = orderId;
  }

})();

// // INITIALIZATION:
async function getKeplr() {
  if (window.keplr) {
    return window.keplr;
  }

  if (document.readyState === "complete") {
    return window.keplr;
  }

  return new Promise((resolve) => {
    const documentStateChange = (event) => {
      if (event.target && event.target.readyState === "complete") {
        resolve(window.keplr);
        document.removeEventListener("readystatechange", documentStateChange);
      }
    };

    document.addEventListener("readystatechange", documentStateChange);
  });
}

async function keplr_connectOsmosis() {
  await window.keplr
    ?.enable("osmosis-1")
    .then(async () => {
      // Connected
      keplr_chains_onConnected();
    })
    .catch(() => {
      // Rejected
      keplr_chains_onRejected();
    });
}

// get osmosis wallet from user's selected account in keplr extension
async function getOsmosisWallet() {
  const wallet = await window.keplr?.getKey("osmosis-1").then((user_key) => {
    return user_key;
  });
  return wallet;
}

// EVENT HANDLERS
async function keplr_chains_onConnected() {
  const wallet = await getOsmosisWallet();
  ui_setWallet(wallet);


  // register event handler: if user changes account:
  window.addEventListener("keplr_keystorechange", keplr_keystore_onChange);
}

async function keplr_chains_onRejected() {
  ui_setWallet(undefined);
}

async function keplr_keystore_onChange(e) {
  const wallet = await getOsmosisWallet();
  ui_setWallet(wallet);
}

// EXPORTED TO A GLOBAL "module" OBJECT FOR INLINE HTML DOM EVENT LISTENERS

export async function btnConnectKeplr_onClick() {
  // connect Keplr wallet extension
  await keplr_connectOsmosis();
}




async function loadOrders(walletAddress) {
  try {
    ui_showLoadingMask({ modalMessage: "Please Wait...", modalTitle: "Fetching Created Orders" });
    const responseCreated = await fetch(`${restUrl}/cosmos/tx/v1beta1/txs?events=message.sender='${walletAddress}'&events=message.action='/cosmwasm.wasm.v1.MsgExecuteContract'&events=wasm._contract_address='osmo1wg5qzw6yn88yz9kxtwvs36fmq5jxa03pg6zptvgte62hrlw0c4rqc9mjtf'&events=wasm.action='create_request'`)
    const dataCreated = await responseCreated.json();


    // build array of created orders
    let createdOrders = [];
    if (dataCreated?.tx_responses?.length >= 0) {
      for (const tx_response of dataCreated.tx_responses) {
        for (const event of tx_response.logs[0].events) {
          if (event.type === "wasm") {
            for (const attribute of event.attributes) {
              if (attribute.key === "id") {
                const orderId = attribute.value;
                createdOrders.push(orderId);
              }
            }
          }
        }
      }
    }


    ui_showLoadingMask({ modalMessage: "Please Wait...", modalTitle: "Fetching Closed Orders" });

    //build array of cancelled orders
    const responseCancelled = await fetch(`${restUrl}/cosmos/tx/v1beta1/txs?events=message.sender='${walletAddress}'&events=message.action='/cosmwasm.wasm.v1.MsgExecuteContract'&events=wasm._contract_address='osmo1wg5qzw6yn88yz9kxtwvs36fmq5jxa03pg6zptvgte62hrlw0c4rqc9mjtf'&events=wasm.action='cancel_request'`)
    const dataCancelled = await responseCancelled.json();

    // loop through and remove cancelled orders from created orders
    let cancelledOrders = [];
    if (dataCancelled?.tx_responses?.length >= 0) {
      for (const tx_response of dataCancelled.tx_responses) {
        for (const event of tx_response.logs[0].events) {
          if (event.type === "wasm") {
            for (const attribute of event.attributes) {
              if (attribute.key === "id") {
                const orderId = attribute.value;
                cancelledOrders.push(orderId);
              }
            }
          }
        }
      }
    }

    // remove cancelled orders from created orders
    createdOrders = createdOrders.filter(order => !cancelledOrders.includes(order));

    // display open orders
    const ordersDiv = document.getElementById('orders');
    if (createdOrders.length === 0) {
      ordersDiv.innerHTML = "No Orders Found";
      return;
    }
    ordersDiv.innerHTML = "";
    createdOrders.forEach(order => {
      const orderDiv = document.createElement('div');
      orderDiv.className = 'order';
      orderDiv.dataset.id = order;
      orderDiv.innerHTML = `
        <p>Order ID: ${order}</p>
        <div class="cancel-button" onclick="cancelOrder(${order})">Cancel Order</div>
      `;
      ordersDiv.appendChild(orderDiv);
    });

  } catch (error) {
    console.error(error);
  } finally {
    ui_hideLoadingMask();
  }
}

async function cancelOrder(orderId) {
  try {
    if (window.getOfflineSignerAuto) {
      const offlineSigner = await window.getOfflineSignerAuto("osmosis-1");
      // const accounts = await offlineSigner.getAccounts();
      const walletAddress = await getOsmosisWallet().then((wallet) => {
        return wallet.bech32Address;
      });

      const client = await getSigningCosmwasmClient({
        rpcEndpoint: "https://rpc.osmosis.zone:443",
        signer: offlineSigner,
      });



      const gasFee = {
        "amount": [
          {
            "amount": "10000",
            "denom": "uosmo"
          }
        ],
        "gas": "200000"
      }


      // const { MsgExecuteContract } = cosmwasm.wasm.v1;
      const msgExecuteContract = MsgExecuteContract.fromAmino({
        "sender": walletAddress,
        "contract": "osmo1wg5qzw6yn88yz9kxtwvs36fmq5jxa03pg6zptvgte62hrlw0c4rqc9mjtf",
        "msg": { "cancel_request": { "id": orderId } },
        "funds": []
      });

      const msg = executeContract(msgExecuteContract);

      ui_showLoadingMask({ modalMessage: "Broadcasting Transaction...", modalTitle: "Please Wait" });

      try {
        ui_hideResponse();
        ui_hideError();
        const result = await client.signAndBroadcast(walletAddress, [msg], gasFee, "by https://jasbanza.github.io/autoswap-cancel-orders");
        ui_showResponse(result);
        ui_removeOrder(orderId);
      } catch (error) {
        ui_showError(error.message);
      }
      ui_hideLoadingMask();
    }
  } catch (error) {
    console.error(error);
  }
}
window.cancelOrder = cancelOrder;
window.btnDisconnectWallet = btnDisconnectWallet;
window.btnConnectWallet = btnConnectWallet;
window.btnCancelCustomOrder = btnCancelCustomOrder;


function btnCancelCustomOrder() {
  const orderId = document.getElementById("orderId").value;
  // if orderId isn't a number, return
  if (!orderId || isNaN(orderId) || !Number.isInteger(Number(orderId)) || orderId < 0 || !Number.isSafeInteger(Number(orderId))) {
    ui_showError("Invalid Order ID");
    return;
  }
  cancelOrder(parseInt(orderId));
}

// UI FUNCTIONS

// function to toggle the mask on and off
function ui_showLoadingMask({ modalMessage = "", modalTitle = "" }) {
  document.getElementById("modalMessage").innerHTML = modalMessage;
  document.getElementById("modalTitle").innerHTML = modalTitle;
  document.getElementById("mask").classList.remove("hidden");
  console.log(`ui_showLoadingMask: ${modalTitle} - ${modalMessage}`);
}

function ui_hideLoadingMask() {
  document.getElementById("mask").classList.add("hidden");
}

/* show and hide response */

// function to update the last transaction hash
function ui_showResponse(result) {
  document.getElementById("divResponse").innerHTML = JSON.stringify(result, null, 2);
  ui_showElementById("responseContainer");
}
function ui_hideResponse() {
  document.getElementById("divResponse").innerHTML = "";
  ui_hideElementById("responseContainer");
}


/* show and hide error messages */
// error handlers
function ui_showError(errorMessage) {
  document.getElementById("divError").innerHTML = errorMessage;
  document.getElementById("errorContainer").classList.remove('hidden');
}
function ui_hideError() {
  document.getElementById("divError").innerHTML = "";
  document.getElementById("errorContainer").classList.add('hidden');
}


async function ui_setWallet(wallet) {
  if (wallet) {
    document.getElementById("walletAddress").innerHTML = wallet.bech32Address;
    ui_showElementById("walletContainer");
    ui_showElementById("orders");
    ui_showElementById("custom-order");
    ui_hideElementById("btnConnect");
 
    await loadOrders(wallet.bech32Address);

  } else {
    ui_hideElementById("walletContainer");
    ui_hideElementById("orders");
    ui_hideElementById("custom-order");
    ui_showElementById("btnConnect");
  }
  ui_reinitialize();
}
// function to reinitialize ui
function ui_reinitialize() {
  ui_hideResponse();
  ui_hideError();
}

function btnDisconnectWallet() {
  // window.keplr?.signOut("osmosis-1");
  ui_setWallet(undefined);
}

function btnConnectWallet() {
  btnConnectKeplr_onClick();
}

function ui_removeOrder(orderId) {
  // Remove the order from the orders div

  const ordersDiv = document.getElementById('orders');
  if (!ordersDiv) return;

  const orderDiv = document.querySelector(`.order[data-id="${orderId}"]`);
  if (!orderDiv) return;

  ordersDiv.removeChild(orderDiv);
}


function ui_showElementById(elementId) {
  try {
    document.getElementById(elementId).classList.remove('hidden');
  } catch (error) {
    console.warn(`ui_showElementById: elementId ${elementId} not found`);
  }
}
function ui_hideElementById(elementId) {
  try {
    document.getElementById(elementId).classList.add('hidden');
  } catch (error) {
    console.warn(`ui_hideElementById: elementId ${elementId} not found`);
  }
}
