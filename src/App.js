import "./App.css";
import { useEffect, useState, useCallback } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, Provider, web3, BN } from "@project-serum/anchor";
import idl from "./idl.json";
import kp from "./.keypair.json";

const { SystemProgram } = web3;

const arr = Object.values(kp._keypair.secretKey);
const secret = new Uint8Array(arr);
const baseAccount = web3.Keypair.fromSecretKey(secret);

const programID = new PublicKey(idl.metadata.address);

const network = clusterApiUrl("devnet");

const opts = {
  preflightCommitment: "processed",
};

const App = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [gifList, setGifList] = useState([]);

  // Check if Phantom injected solana object and then check if its phantom.
  const IsConnected = async () => {
    try {
      const { solana } = window;

      if (solana) {
        if (solana.isPhantom) {
          console.log("Phantom Wallet detected");

          const response = await solana.connect({ onlyIfTrusted: true });
          console.log("pubKey = ", response.publicKey.toString());
          setWalletAddress(response.publicKey.toString());
        }
      } else {
        alert("Solana Wallet not detected");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const connectWallet = async () => {
    const { solana } = window;

    if (solana && solana.isPhantom) {
      const response = await solana.connect();
      console.log("Wallet Connected", response.publicKey.toString());
      setWalletAddress(response.publicKey.toString());
    }
  };

  const onInputChange = (event) => {
    const { value } = event.target;
    setInputValue(value);
  };

  const getProvider = () => {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(
      connection,
      window.solana,
      opts.preflightCommitment
    );
    return provider;
  };

  const renderNotConnected = () => (
    <button
      className="cta-button connect-wallet-button"
      onClick={connectWallet}
    >
      Connect Wallet
    </button>
  );

  const renderConnected = () => {
    if (gifList === null) {
      return (
        <div className="connected-container">
          <button
            className="cta-button submit-gif-button"
            onClick={createGifAccount}
          >
            Create Account
          </button>
        </div>
      );
    } else {
      return (
        <div className="connected-container">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendGif();
            }}
          >
            <input
              type="text"
              placeholder="Enter Link"
              value={inputValue}
              onChange={onInputChange}
            />
            <button type="submit" className="cta-button submit-gif-button">
              Submit
            </button>
          </form>
          <div className="gif-grid">
            {gifList.map((item, index) => (
              <div className="gif-item" key={index}>
                <img src={item.gifLink} alt="gif" />
                <div className="vote">
                  <span className="vote-counter">
                    {item.votes.toString()} votes
                  </span>
                  <button
                    className="vote-button vote-up-button"
                    onClick={upVote}
                    value={index}
                  >
                    {" "}
                    Upvote{" "}
                  </button>
                  <button
                    className="vote-button vote-down-button"
                    onClick={downVote}
                    value={index}
                  >
                    {" "}
                    DownVote{" "}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
  };
  // Calling the isConnected function.
  useEffect(() => {
    const onLoad = async () => {
      await IsConnected();
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  const createGifAccount = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      console.log("ping");
      await program.rpc.startStuffOff({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount],
      });
      console.log(
        "Created a new BaseAccount w/ address:",
        baseAccount.publicKey.toString()
      );
      await getGifList();
    } catch (error) {
      console.log("Error creating BaseAccount account:", error);
    }
  };

  const getGifList = useCallback(async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      const account = await program.account.baseAccount.fetch(
        baseAccount.publicKey
      );

      console.log("account: ", account);
      setGifList(account.gifList);
    } catch (error) {
      console.log("error", error);
      setGifList(null);
    }
  }, []);

  const sendGif = async () => {
    if (inputValue.length === 0) {
      alert("Please enter a valid gif link");
      return;
    }
    setInputValue(""); // Clear input field
    console.log("Gif link: ", inputValue);
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.addGif(inputValue, {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        },
      });
      console.log("Gif added", inputValue);
      await getGifList();
    } catch (error) {
      console.log("Gif was not send due to an error: ", error);
    }
  };

  const upVote = async (event) => {
    try {
      event.preventDefault();
      const target = event.target;
      const index = target.value;
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.upVote(new BN(index), {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        },
      });
      console.log("Upvote successful", index);

      await getGifList();
    } catch (error) {
      console.log("vote unsuccessful");
    }
  };

  const downVote = async (event) => {
    try {
      event.preventDefault();
      const target = event.target;
      const index = target.value;
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.downVote(new BN(index), {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        },
      });
      console.log("DownVote successful", index);

      await getGifList();
    } catch (error) {
      console.log("vote unsuccessful");
    }
  };

  useEffect(() => {
    if (walletAddress) {
      console.log("Getting gifs");
      getGifList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  return (
    <div className="App">
      <div className="walletAddress ? 'authed-container' : 'container'}">
        <div className="header-container">
          <p className="header">Voting Dapp</p>
          <p className="sub-text">
            A Dapp where you can upload pictures and vote on them.
          </p>
          {!walletAddress && renderNotConnected()}
          {walletAddress && renderConnected()}
        </div>
      </div>
    </div>
  );
};

export default App;
