var express = require('express');
var router = express.Router();
const helper = require('../helper/helper');
const ethers = require('ethers')
const abi = require('./uniswapRouter2ABI.json') 
const { ChainId, Fetcher, WETH, Route, Trade, TokenAmount, TradeType, Percent, Token } = require('@uniswap/sdk');

const {JsonRpcProvider} =   require("@ethersproject/providers");
const provider          =   new JsonRpcProvider('https://mainnet.infura.io/v3/76cb5401dc76458da87b1fbb1f8730fe'); // mainnet
const uniSwapRouter2Address  = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; //mainnet address

router.post('/calculateGassLimitSendToken', async (req, res) => {
    if(req.body.walletAddress && req.body.numTokens && req.body.symbol  && req.body.receiverAddress && req.body.providerType){
        let contractAddress = await helper.getContractAddress(req.body.symbol, req.body.providerType)

        console.log('contractAddress',contractAddress)
        if(contractAddress){

            let Web3Client = await helper.getWebClient(req.body.providerType)
            let contract = await helper.getContractAddressInstanse(contractAddress, Web3Client)
            let response = await helper.countNonceAndData(req.body.walletAddress, req.body.numTokens, req.body.receiverAddress, contract, Web3Client)

            let nonce = response.nonce;
            let data  = response.data;

            let gaseLimit = await helper.calculateGassLimitEstimate(req.body.walletAddress, nonce, contractAddress, data, Web3Client)
            let responseGass = {
                gaseLimit  :   gaseLimit
            }
            res.status(200).send(responseGass);
        }else{
            let response = {
                message  :   'Contract address is not available against this symbol!!!'
            }
            res.status(404).send(response);
        }
    }else{
        let response = {
            message  :   'Payload missing!!!'
        }
        res.status(404).send(response);
    }
})


router.post('/sendToken', async(req, res) => {
    if(req.body.walletAddress && req.body.numTokens && req.body.symbol && req.body.receiverAddress && req.body.senderPrivateKey && req.body.providerType){

        let contractAddress = await helper.getContractAddress(req.body.symbol, req.body.providerType)
        if(contractAddress){
            let Web3Client = await helper.getWebClient(req.body.providerType)

            let contract = await helper.getContractAddressInstanse(contractAddress, Web3Client)
            let response = await helper.countNonceAndData(req.body.walletAddress, req.body.numTokens, req.body.receiverAddress, contract, Web3Client)
            let nonce = response.nonce;
            let data  = response.data;            

            let gaseLimit = await helper.calculateGassLimit(req.body.walletAddress, nonce, contractAddress, data, Web3Client)
            
            console.log('gaseLimit', gaseLimit)
            let balance = await helper.getWalletAddressBalance(req.body.walletAddress, contractAddress, Web3Client)
            console.log('balance of wallet are =====', balance)

            console.log('aaaaaaaaaaaaaa')
            if( balance <  req.body.numTokens ){
                let response = {
                    message  :   `Insufficient balance!!!`
                }
                res.status(404).send(response);
            }else{
        
                let trasctionData = await helper.transferTokenToOtherWallets(gaseLimit, data, req.body.walletAddress, nonce, req.body.senderPrivateKey, contractAddress, Web3Client)
                res.status(200).send(trasctionData);
            }
        }else{
            let response = {
                message  :   'Contract address is not available against this symbol!!!'
            }
            res.status(404).send(response);
        } 
    }else{

        let response = {
            message  :   'Payload missing!!!'
        }
        res.status(404).send(response);
    }
})

//send coin code
router.post('/calculateGassFeeCoin', async(req, res) => {
    if(req.body.walletAddress && req.body.receiverAddress  && req.body.amount  && req.body.providerType){
        
        let Web3Client = await helper.getWebClient(req.body.providerType)
        const isvalid = await Web3Client.utils.isAddress(req.body.receiverAddress);
        if (!isvalid){
            
            res.status(400).json({ error: `This wallet address is not valid. Kindly confirm the address and try again.` });
        }else{

            let fee = await  helper.estimateGasForEthTransaction(req.body.walletAddress, req.body.receiverAddress, req.body.amount, Web3Client);
            res.status(fee.status).send(fee);
        } 
    }else{

        let response = {
            message  : 'Payload Missing'
        }
        res.status(404).send(response);
    }
})


router.post('/sendCoin', async(req, res) => {
    if(req.body.walletAddress && req.body.receiverAddress && req.body.amount && req.body.privateKey && req.body.providerType){
        let walletAddress = req.body.walletAddress
        let privateKey    = req.body.privateKey
        let receiverAddress = req.body.receiverAddress 
        let amount        = req.body.amount 

        let Web3Client = await helper.getWebClient(req.body.providerType)
        const isvalid = Web3Client.utils.isAddress(receiverAddress);
        console.log(isvalid)
        if(!isvalid){   //Web3Client
            res.status(400).json({ error: `This wallet address is not valid. Kindly confirm the address and try again.` });
        }else{
            
            try{
                //get ether balance before transaction
                const ethBalance = await Web3Client.eth.getBalance(walletAddress)
                console.log(ethBalance)
                // convert amount to ether from wei
                const ethAmount = Web3Client.utils.fromWei(ethBalance, 'ether')
                //cgeck sending amount is greater then ether balance
                if (ethAmount > amount){
                    const count = await Web3Client.eth.getTransactionCount(walletAddress, 'latest')
                    let etherValue = Web3Client.utils.toWei(amount.toString(), 'ether');

                    const transaction = {
                        'to': receiverAddress,
                        'value': etherValue,
                        'gas': 30000,
                        'nonce': count,
                        // optional data field to send message or execute smart contract
                    };

                    const signedTx = await Web3Client.eth.accounts.signTransaction(transaction, privateKey);
                    Web3Client.eth.sendSignedTransaction(signedTx.rawTransaction);
                    // deductTransactionFee(walletDetail.user_id, feeInSwet)
                    return res.status(200).json({ transactionHash: signedTx.transactionHash });
                }else{
                    let response = {
                        message  : 'insufficent fund!!!'
                    }
                    res.status(404).send(response);
                }

            }catch(error){
                console.log(error)
                let response = {
                    message  : error
                }
                res.status(404).send(response);
            }
        }
    }else{

        let response = {
            message  :   'Payload missing!!!'
        }
        res.status(404).send(response);
    }
})


//uniswap
//######################################################################################################
//##################################      TOKEN TO COIN PRICE AND SWAP     #############################
//######################################################################################################
router.post('/tokenToCoinPrice', async(req, res) => {
    if(req.body.amount && req.body.symbol && req.body.providerType && req.body.type){
        let etherAmount  =  parseFloat(req.body.amount) 
        let toSymbol     =  req.body.symbol
        let type         =  req.body.type
        let providerType =  req.body.providerType
        let contractAddress = await helper.getContractAddress(toSymbol, providerType)
        if(contractAddress){
            try{
                const chainId  = ChainId.MAINNET;
                const tokenAddress = contractAddress;
                var amountIn = ethers.utils.parseEther(String(etherAmount));
                const swapToken = await Fetcher.fetchTokenData(chainId, tokenAddress);
                const weth = WETH[chainId];
                const pair = await Fetcher.fetchPairData(weth, swapToken, provider);

                const route = new Route([pair], swapToken);
                const trade = new Trade(route, new TokenAmount(swapToken, amountIn.toString()), TradeType.EXACT_INPUT)

                const ethPriceInToken = route.midPrice.invert().toSignificant(6);
                const ethPrice = route.midPrice.toSignificant(6);
                let finalPrice = Number(etherAmount) * ethPrice;
                let executionPrice = trade.executionPrice.toSignificant(6)
                console.log("1 Eth = ", ethPriceInToken)
                console.log("total eth by given by token= ", finalPrice)
                console.log("Minimum received= ", executionPrice * Number(etherAmount))
        
                const minimumReceived = executionPrice * Number(etherAmount)
                const result = { ethPriceInToken: ethPriceInToken, ethCalculate: finalPrice, minimumReceived: minimumReceived }
                res.status(200).send(result);
            }catch(error){
                console.log(error)
                let response = {
                    message  : error
                }
                res.status(404).send(response);
            }
        }else{
            let response = {
                message  : 'Contract address not exists!!!'
            }
            res.status(404).send(response);
        }
    }else{
        let response = {
            message  : 'Payload Missing!!!'
        }
        res.status(404).send(response);
    }
})

router.post('/tokenToCoinSwap', async(req, res) => {
    if(req.body.amount && req.body.symbol && req.body.providerType && req.body.type && req.body.walletAddress && req.body.privateKey){
        let etherAmount  =  parseFloat(req.body.amount) 
        let toSymbol     =  req.body.symbol
        let type         =  req.body.type
        let providerType =  req.body.providerType
        let walletAddress=  req.body.walletAddress
        let privateKey   =  req.body.privateKey
       
        let contractAddress = await helper.getContractAddress(toSymbol, providerType)
        if(contractAddress){
            try{
                // chain id for test net
                const chainId = ChainId.MAINNET;
                //token address to swap 
                const tokenAddress = contractAddress
                var amountEth = ethers.utils.parseEther(String(etherAmount));
                //fetch token data
                const swapToken = await Fetcher.fetchTokenData(chainId, tokenAddress);
                //fetch ether through chain id
                const weth = WETH[chainId];
                //fetching pair data for swap ether to token
                const pair = await Fetcher.fetchPairData(weth, swapToken, provider);
                const route = new Route([pair], weth);
                const trade = new Trade(route, new TokenAmount(weth, String(amountEth)), TradeType.EXACT_INPUT)
                console.log(route.midPrice.toSignificant(6))
                console.log(route.midPrice.invert().toSignificant(6))
                console.log(trade.executionPrice.toSignificant(6))
                console.log(trade.nextMidPrice.toSignificant(6))
                //set Tolerance 0.5%
                const slippageTolerance = new Percent('50', "10000"); //10 bips 1 bip = 0.001%
                const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
                //set path of token and ether
                const path = [weth.address, swapToken.address];
                const to = walletAddress;
                const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
                const value = trade.inputAmount.raw;
                const singer = new ethers.Wallet(privateKey);
                const account = singer.connect(provider);
                const uniswap = new ethers.Contract(uniSwapRouter2Address, abi,
                account);
                try {
                    const tx = uniswap.swapExactETHForTokens(
                        String(amountOutMin),
                        path,
                        to,
                        deadline,
                        { value: String(value), gasPrice: 5.5e10 }
                    );
                    return res.status(200).json({ message: 'Transaction Submitted' });
                } catch (error) {
                    console.log("🚀 ~ file: uniswap.controller.js ~ line 95 ~ exports.swapEtherToToken= ~ error", error)
                    return res.status(400).json({ error: error.reason });
                }
            }catch(error){
                console.log(error)
                let response = {
                    message  : error
                }
                res.status(404).send(response);
            }
        }else{
            let response = {
                message  : 'Contract address not exists!!!'
            }
            res.status(404).send(response);
        }
    }else{
        let response = {
            message  : 'Payload Missing!!!'
        }
        res.status(404).send(response);
    }
})

//######################################################################################################
//##################################      COIN TO TOKEN PRICE AND SWAP     #############################
//######################################################################################################

router.post('/coinToTokenPrice', async(req, res) => {
    if(req.body.amount && req.body.symbol && req.body.providerType && req.body.type){
        let etherAmount  =  parseFloat(req.body.amount) 
        let toSymbol     =  req.body.symbol
        let type         =  req.body.type
        let providerType =  req.body.providerType
       
        let contractAddress = await helper.getContractAddress(toSymbol, providerType)
        if(contractAddress){
            try{
                // chain id for test net
                const chainId = ChainId.MAINNET;
                //token address to swap 
                const tokenAddress = contractAddress;

                var amountEth = ethers.utils.parseEther(String(etherAmount));
                //fetch token data
                const swapToken = await Fetcher.fetchTokenData(chainId, tokenAddress);
                //fetch ether through chain id
                const weth = WETH[chainId];
                //fetching pair data for swap ether to token
                const pair = await Fetcher.fetchPairData(swapToken, weth, provider);
                const route = new Route([pair], weth);
                const trade = new Trade(route, new TokenAmount(weth, String(amountEth)), TradeType.EXACT_INPUT)
                const tokenPriceInEth = route.midPrice.invert().toSignificant(6);
                const tokenPrice = route.midPrice.toSignificant(6);
                let finalPrice = Number(etherAmount) * Number(tokenPrice);
                let executionPrice = trade.executionPrice.toSignificant(6)
                finalPrice = Math.round((finalPrice + Number.EPSILON) * 100) / 100;

                console.log("1 token = ", tokenPriceInEth)
                console.log("total token by given by eth= ", finalPrice)
                console.log("Minimum received= ", executionPrice * etherAmount)

                const minimumReceived = executionPrice * etherAmount
                const result = { tokenPriceInEth: tokenPriceInEth, tokenCalculate: finalPrice, minimumReceived: minimumReceived }
                return res.status(200).json(result);
            }catch(error){
                console.log(error)
                let response = {
                    message  : error
                }
                res.status(404).send(response);
            }
        }else{
            let response = {
                message  : 'Contract address not exists!!!'
            }
            res.status(404).send(response);
        }
    }else{
        let response = {
            message  : 'Payload Missing!!!'
        }
        res.status(404).send(response);
    }
})


router.post('/coinToTokenSwap', async(req, res) => {
    if(req.body.amount && req.body.symbol && req.body.providerType && req.body.type && req.body.walletAddress && req.body.privateKey){
        let etherAmount  =  parseFloat(req.body.amount) 
        let toSymbol     =  req.body.symbol
        let type         =  req.body.type
        let providerType =  req.body.providerType
        let walletAddress=  req.body.walletAddress
        let privateKey   =  req.body.privateKey
       
        let contractAddress = await helper.getContractAddress(toSymbol, providerType)
        if(contractAddress){
            try{
                // chain id for test net
                const chainId = ChainId.MAINNET;
                //token address to swap 
                const tokenAddress = contractAddress
                var amountEth = ethers.utils.parseEther(String(etherAmount));
                //fetch token data
                const swapToken = await Fetcher.fetchTokenData(chainId, tokenAddress);
                //fetch ether through chain id
                const weth = WETH[chainId];
                //fetching pair data for swap ether to token
                const pair = await Fetcher.fetchPairData(swapToken, weth , provider);
                const route = new Route([pair], weth);
                const trade = new Trade(route, new TokenAmount(weth, String(amountEth)), TradeType.EXACT_INPUT)
                console.log(route.midPrice.toSignificant(6))
                console.log(route.midPrice.invert().toSignificant(6))
                console.log(trade.executionPrice.toSignificant(6))
                console.log(trade.nextMidPrice.toSignificant(6))
                //set Tolerance 0.5%
                const slippageTolerance = new Percent('50', "10000"); //10 bips 1 bip = 0.001%
                const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
                //set path of token and ether
                const path = [weth.address, swapToken.address];
                const to = walletAddress;
                const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
                const value = trade.inputAmount.raw;
                const singer = new ethers.Wallet(privateKey);
                const account = singer.connect(provider);
                const uniswap = new ethers.Contract(uniSwapRouter2Address, abi,
                account);
                try {
                    const tx = uniswap.swapExactETHForTokens(
                        String(amountOutMin),
                        path,
                        to,
                        deadline,
                        { value: String(value), gasPrice: 5.5e10 }
                    );
                    return res.status(200).json({ message: 'Transaction Submitted' });
                } catch (error) {
                    console.log("🚀 ~ file: uniswap.controller.js ~ line 95 ~ exports.swapEtherToToken= ~ error", error)
                    return res.status(400).json({ error: error.reason });
                }
            }catch(error){
                console.log(error)
                let response = {
                    message  : error
                }
                res.status(404).send(response);
            }
        }else{
            let response = {
                message  : 'Contract address not exists!!!'
            }
            res.status(404).send(response);
        }
    }else{
        let response = {
            message  : 'Payload Missing!!!'
        }
        res.status(404).send(response);
    }
})

//######################################################################################################
//##################################      TOKEN TO TOKEN PRICE AND SWAP     ############################
//######################################################################################################
router.post('/tokenToTokenPrice', async(req, res) => {
    if(req.body.amount && req.body.symbol && req.body.providerType && req.body.type && req.body.toSymbol){
        let etherAmount  =  parseFloat(req.body.amount) 
        let fromSymbol   =  req.body.symbol
        let toSymbol     =  req.body.toSymbol
        let type         =  req.body.type
        let providerType =  req.body.providerType
       
        let fromContractAddress = await helper.getContractAddress(fromSymbol, providerType)
        let toContractAddress   = await helper.getContractAddress(toSymbol, providerType)

        if(fromContractAddress && toContractAddress){
            try{
                // chain id for test net
                const chainId = ChainId.MAINNET;
                //token address to swap 
                // const tokenAddress = contractAddress;

                var amountEth = ethers.utils.parseEther(String(etherAmount));
                //fetch token data
                const fromSwapToken = await Fetcher.fetchTokenData(chainId, fromContractAddress);
                const toSwapToken  = await Fetcher.fetchTokenData(chainId, toContractAddress);
                //fetch ether through chain id
                const weth = WETH[chainId];
                //fetching pair data for swap ether to token
                const pair = await Fetcher.fetchPairData(fromSwapToken, toSwapToken, provider);
                const route = new Route([pair], fromSwapToken);
                const trade = new Trade(route, new TokenAmount(fromSwapToken, String(amountEth)), TradeType.EXACT_INPUT)
                const tokenPriceInEth = route.midPrice.invert().toSignificant(6);
                const tokenPrice = route.midPrice.toSignificant(6);
                let finalPrice = Number(etherAmount) * Number(tokenPrice);
                let executionPrice = trade.executionPrice.toSignificant(6)
                finalPrice = Math.round((finalPrice + Number.EPSILON) * 100) / 100;

                console.log("1 token = ", tokenPriceInEth)
                console.log("total token by given by eth= ", finalPrice)
                console.log("Minimum received= ", executionPrice * etherAmount)

                const minimumReceived = executionPrice * etherAmount
                const result = { tokenPriceInEth: tokenPriceInEth, tokenCalculate: finalPrice, minimumReceived: minimumReceived }
                return res.status(200).json(result);
            }catch(error){
                console.log(error)
                let response = {
                    message  : error
                }
                res.status(404).send(response);
            }
        }else{
            let response = {
                message  : 'Contract address not exists!!!'
            }
            res.status(404).send(response);
        }
    }else{
        let response = {
            message  : 'Payload Missing!!!'
        }
        res.status(404).send(response);
    }
})


router.post('/tokenToTokenSwap', async(req, res) => {
    if(req.body.amount && req.body.fromSymbol && req.body.toSymbol && req.body.providerType && req.body.type && req.body.walletAddress && req.body.privateKey){
        let etherAmount  =  parseFloat(req.body.amount) 
        let toSymbol     =  req.body.toSymbol
        let fromSymbol   =  req.body.fromSymbol
        let type         =  req.body.type
        let providerType =  req.body.providerType
        let walletAddress=  req.body.walletAddress
        let privateKey   =  req.body.privateKey
       
        let fromContractAddress = await helper.getContractAddress(fromSymbol, providerType)
        let toContractAddress   = await helper.getContractAddress(toSymbol, providerType)
        if(toContractAddress && fromContractAddress){
            try{
                // chain id for test net
                const chainId = ChainId.MAINNET;
                //token address to swap 
                // const tokenAddress = contractAddress
                var amountEth = ethers.utils.parseEther(String(etherAmount));
                //fetch token data
                const swapTokenF = await Fetcher.fetchTokenData(chainId, fromContractAddress);
                const swapTokenT = await Fetcher.fetchTokenData(chainId, toContractAddress);

                //fetch ether through chain id
                const weth = WETH[chainId];
                //fetching pair data for swap token to token
                const pair = await Fetcher.fetchPairData(swapTokenF, swapTokenT , provider);
                const route = new Route([pair], weth);
                const trade = new Trade(route, new TokenAmount(weth, String(amountEth)), TradeType.EXACT_INPUT)
                console.log(route.midPrice.toSignificant(6))
                console.log(route.midPrice.invert().toSignificant(6))
                console.log(trade.executionPrice.toSignificant(6))
                console.log(trade.nextMidPrice.toSignificant(6))
                //set Tolerance 0.5% (difference b/t send time price and confirmation price)
                const slippageTolerance = new Percent('50', "10000"); //10 bips 1 bip = 0.001%
                const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
                //set path of token and token
                const path = [swapTokenF.address, swapTokenT.address];
                const to = walletAddress;
                const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
                const value = trade.inputAmount.raw;
                const singer = new ethers.Wallet(privateKey);
                const account = singer.connect(provider);
                const uniswap = new ethers.Contract(uniSwapRouter2Address, abi,
                account);
                try {
                    const tx = uniswap.swapExactETHForTokens( //migration (transfer token from one blockchain to other)
                        String(amountOutMin),
                        path,
                        to,
                        deadline,
                        { value: String(value), gasPrice: 5.5e10 }
                    );
                    return res.status(200).json({ message: 'Transaction Submitted' });
                } catch (error) {
                    console.log("🚀 ~ file: uniswap.controller.js ~ line 95 ~ exports.swapEtherToToken= ~ error", error)
                    return res.status(400).json({ error: error.reason });
                }
            }catch(error){
                console.log(error)
                let response = {
                    message  : error
                }
                res.status(404).send(response);
            }
        }else{
            let response = {
                message  : 'Contract address not exists!!!'
            }
            res.status(404).send(response);
        }
    }else{
        let response = {
            message  : 'Payload Missing!!!'
        }
        res.status(404).send(response);
    }
})

module.exports = router;