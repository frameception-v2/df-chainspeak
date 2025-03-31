"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { useFrameSDK } from "~/hooks/useFrameSDK";
import { CONTRACT_ADDRESS, CHAIN_ID } from "../lib/constants";
import { CommentsV1Abi } from "../lib/contractAbi";
import { ethers } from "ethers";

function CommentCard() {
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const handlePostComment = async () => {
    if (!comment.trim()) {
      setStatus("Please enter a comment");
      return;
    }

    setIsPosting(true);
    setStatus("Connecting to wallet...");

    try {
      // Request wallet connection
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet detected. Please install a wallet like MetaMask.");
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      
      // Check if we're on the right chain
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== `0x${parseInt(CHAIN_ID).toString(16)}`) {
        setStatus(`Please switch to Base network (Chain ID: ${CHAIN_ID})`);
        
        // Try to switch to Base
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${parseInt(CHAIN_ID).toString(16)}` }],
          });
        } catch (switchError) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: `0x${parseInt(CHAIN_ID).toString(16)}`,
                    chainName: 'Base',
                    nativeCurrency: {
                      name: 'ETH',
                      symbol: 'ETH',
                      decimals: 18
                    },
                    rpcUrls: ['https://mainnet.base.org'],
                    blockExplorerUrls: ['https://basescan.org']
                  },
                ],
              });
            } catch (addError) {
              throw new Error("Failed to add Base network to your wallet");
            }
          } else {
            throw switchError;
          }
        }
      }

      setStatus("Preparing transaction...");
      
      // Create a provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Create contract instance
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CommentsV1Abi, signer);
      
      // Current timestamp + 1 hour for deadline
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      // Prepare comment data
      const commentData = {
        content: comment,
        metadata: JSON.stringify({ source: "farcaster-frame" }),
        targetUri: window.location.href,
        parentId: ethers.constants.HashZero, // No parent comment
        author: userAddress,
        appSigner: userAddress, // Using the same address for simplicity
        nonce: 0, // This would normally be fetched from the contract
        deadline: deadline
      };
      
      // Empty app signature for simplicity (in a real app, this would be properly signed)
      const appSignature = "0x";
      
      setStatus("Sending transaction...");
      
      // Send transaction
      const tx = await contract.postCommentAsAuthor(commentData, appSignature);
      
      setStatus("Transaction sent! Waiting for confirmation...");
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      setStatus("Comment posted successfully! Transaction hash: " + receipt.transactionHash);
      setComment("");
    } catch (error) {
      console.error("Error posting comment:", error);
      setStatus(`Error: ${error.message || "Failed to post comment"}`);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post an Onchain Comment</CardTitle>
        <CardDescription>
          Your comment will be stored on Base blockchain
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full gap-2">
          <Label htmlFor="comment">Your Comment</Label>
          <Textarea
            id="comment"
            placeholder="Type your comment here..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px]"
          />
        </div>
        {status && (
          <div className="mt-2 text-sm text-gray-500">
            {status}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handlePostComment} 
          disabled={isPosting || !comment.trim()}
          className="w-full"
        >
          {isPosting ? "Posting..." : "Post Comment"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function Frame() {
  const { isSDKLoaded } = useFrameSDK();

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-[300px] mx-auto py-2 px-2">
      <CommentCard />
    </div>
  );
}
