from web3 import Web3
uniswap_v2_factory_abi = [  # Minimal ABI for Factory contract
    {
        "constant": True,
        "inputs": [{"name": "tokenA", "type": "address"}, {"name": "tokenB", "type": "address"}],
        "name": "getPair",
        "outputs": [{"name": "", "type": "address"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "allPairsLength",
        "outputs": [{"name": "", "type": "uint256"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "uint", "type": "uint256"}],
        "name": "allPairs",
        "outputs": [{"name": "pair", "type": "address"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    }
]

pair_abi = [
    {"constant": True, "inputs": [], "name": "token0", "outputs": [{"name": "", "type": "address"}],
     "stateMutability": "view", "type": "function"},
    {"constant": True, "inputs": [], "name": "token1", "outputs": [{"name": "", "type": "address"}],
     "stateMutability": "view", "type": "function"},
    {"constant": True, "inputs": [], "name": "totalSupply", "outputs": [{"name": "", "type": "uint256"}],
     "stateMutability": "view", "type": "function"},
    {"constant": True, "inputs": [], "name": "getReserves",
     "outputs": [{"name": "reserve0", "type": "uint112"}, {"name": "reserve1", "type": "uint112"},
                 {"name": "blockTimestampLast", "type": "uint32"}], "stateMutability": "view", "type": "function"},
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "sender", "type": "address"},
            {"indexed": False, "name": "amount0In", "type": "uint256"},
            {"indexed": False, "name": "amount1In", "type": "uint256"},
            {"indexed": False, "name": "amount0Out", "type": "uint256"},
            {"indexed": False, "name": "amount1Out", "type": "uint256"},
            {"indexed": True, "name": "to", "type": "address"}
        ],
        "name": "Swap",
        "type": "event"
    }
]

token_abi = [
    {"constant": True, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}],
     "stateMutability": "view", "type": "function"},
    {"constant": True, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}],
     "stateMutability": "view", "type": "function"},
    {
        "constant": True,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]


BASE_RPC_URL = "https://mainnet.base.org"  # Base RPC URL
web3 = Web3(Web3.HTTPProvider(BASE_RPC_URL))

# Ensure the connection to the Base chain
if web3.is_connected():
    print("Connected to Base Chain")

# Example Uniswap V2 Factory contract address (replace with actual on Base)
uniswap_v2_factory_address = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6"  # Uniswap V2 factory (Ethereum mainnet example)

# Create contract instance for the Uniswap V2 Factory
factory_contract = web3.eth.contract(address=web3.to_checksum_address(uniswap_v2_factory_address),
                                     abi=uniswap_v2_factory_abi)

# Fetch the pair length
all_pairs_length = factory_contract.functions.allPairsLength().call()
print(f"All pairs length: {all_pairs_length}")


def calculate_market_cap(token_contract, token_symbol, reserve0, reserve1):
    try:
        # Fetch total supply
        total_supply = token_contract.functions.totalSupply().call()

        # Determine price based on liquidity reserves
        price_per_token = reserve1 / reserve0 if reserve0 > 0 else 0

        # Calculate market cap
        market_cap = total_supply * price_per_token

        print(f"💰 {token_symbol} Market Cap: ${market_cap:,.2f}")
        return market_cap
    except Exception as e:
        print(f"Error calculating market cap: {e}")


def check_minting_ability(token_contract, token_name):
    try:
        token_contract.functions.mint().call()
        print(
            f"Mint status: MINTABLE, token address: {token_contract.address}, token name: {token_name}"
        )
        print(
            f"Total Supply Status: ❌ NOT FIXED, token address: {token_contract.address}, token name: {token_name}")
        return "MINTABLE", "NOT FIXED"
    except:
        print(
            f"Mint status: NOT MINTABLE, token address: {token_contract.address}, token name: {token_name}"
        )
        print(
            f"Total Supply Status: ✅ FIXED, token address: {token_contract.address}, token name: {token_name}")
        return "NOT MINTABLE", "FIXED"


def check_ownership_status(token_contract):
    try:
        owner_address = token_contract.functions.owner().call()
        if owner_address == "0x0000000000000000000000000000000000000000":
            print(f"RENOUNCED for token {token_contract.address}")
            return "RENOUNCED"
        else:
            print(f"NOT RENOUNCED (Owner: {owner_address}) for token {token_contract.address}")
            return "NOT RENOUNCED"
    except Exception:
        print("Ownership function not found")


def get_token_age(web3, token_address):
    try:
        # Get the transaction that created the contract
        tx_hash = web3.eth.get_transaction_receipt(token_address).transactionHash
        tx_details = web3.eth.get_transaction(tx_hash)

        # Get block details
        creation_block = tx_details["blockNumber"]
        block_details = web3.eth.get_block(creation_block)
        creation_timestamp = block_details["timestamp"]

        # Convert to human-readable format
        creation_date = datetime.datetime.utcfromtimestamp(creation_timestamp)
        current_date = datetime.datetime.utcnow()
        token_age_days = (current_date - creation_date).days

        return f"Token {token_address} age: {token_age_days} days"

    except Exception as e:
        return f"Error fetching token age: {e}"


def check_self_destruct(web3, contract_address):
    bytecode = web3.eth.get_code(contract_address).hex()
    if "ff" in bytecode or "f0" in bytecode:
        print("YES (Self-Destruct Opcode Found)")
        return "YES"
    print("NO (Contract is Permanent)")
    return "NO"


def get_24h_volume(pair_contract):
    try:
        latest_block = web3.eth.block_number
        blocks_per_day = 24 * 60 * 60 // 12
        past_block = max(0, latest_block - blocks_per_day)

        # Swap event signature
        swap_event_signature = web3.keccak(text="Swap(address,uint256,uint256,uint256,uint256,address)").hex()

        # Get Swap events from past 24h
        logs = web3.eth.get_logs({
            "fromBlock": past_block,
            "toBlock": latest_block,
            "address": pair_contract.address,
            "topics": [swap_event_signature if swap_event_signature.startswith('0x') else '0x' + swap_event_signature]
        })

        total_volume_token0 = 0
        total_volume_token1 = 0

        if not logs:
            print("No swaps detected in the last 24 hours.")
            return 0, 0

        # Process each log
        for log in logs:
            data = web3.eth.contract(address=pair_contract.address, abi=pair_abi).events.Swap().process_log(log)
            total_volume_token0 += data["args"]["amount0In"]
            total_volume_token1 += data["args"]["amount1In"]

        print(f"24h Volume: {total_volume_token0} Token0, {total_volume_token1} Token1 for pair {pair_address}")
        return total_volume_token0, total_volume_token1

    except Exception as e:
        print(f"Error fetching 24h volume: {e}")


for i in range(all_pairs_length - 10, all_pairs_length):
    pair_address = factory_contract.functions.allPairs(i).call()
    print(f"pair address {i}: {pair_address}")
    pair_contract = web3.eth.contract(address=pair_address, abi=pair_abi)

    # Get total supply of LP tokens
    total_lp_tokens = pair_contract.functions.totalSupply().call()
    print(f"Total Supply of LP Tokens: {total_lp_tokens}")

    # Get token addresses
    token_0 = pair_contract.functions.token0().call()
    token_1 = pair_contract.functions.token1().call()
    token0_contract = web3.eth.contract(address=token_0, abi=token_abi)
    token1_contract = web3.eth.contract(address=token_1, abi=token_abi)

    # Get token names and symbols
    token0_name = token0_contract.functions.name().call()
    token0_symbol = token0_contract.functions.symbol().call()
    token1_name = token1_contract.functions.name().call()
    token1_symbol = token1_contract.functions.symbol().call()
    print(f"Token 0: {token0_name} ({token0_symbol}) for pair {pair_address}")
    print(f"Token 1: {token1_name} ({token1_symbol}) for pair {pair_address}")

    # Fetch liquidity reserves
    liquidity_status = ''
    reserves = pair_contract.functions.getReserves().call()
    reserve0, reserve1 = reserves[0], reserves[1]

    print(f"Liquidity Reserves: {reserve0} {token0_symbol}, {reserve1} {token1_symbol}")

    if reserve0 == 0 and reserve1 == 0:
        liquidity_status = '❌ NOT LOCKED'
    else:
        liquidity_status = '✅ LOCKED'
    print(f"Liquidity status: {liquidity_status}")

    # Calculate market cap
    market_cap_0 = calculate_market_cap(token_contract=token0_contract, token_symbol=token0_symbol, reserve0=reserve0,
                                        reserve1=reserve1)
    market_cap_1 = calculate_market_cap(token_contract=token1_contract, token_symbol=token1_symbol, reserve0=reserve0,
                                        reserve1=reserve1)

    # Check if each token from the pair is mintable
    mintable0, ts_status0 = check_minting_ability(token0_contract, token0_name)
    mintable1, ts_status1 = check_minting_ability(token1_contract, token1_name)

    # Check if each token has owner renounced or not
    ownership0 = check_ownership_status(token0_contract)
    ownership1 = check_ownership_status(token1_contract)

    # Calculate token age
    get_token_age(web3=web3, token_address=token0_contract.address)
    get_token_age(web3=web3, token_address=token1_contract.address)

    # Check if selfdestruct function exists
    selfdestruct0 = check_self_destruct(web3=web3, contract_address=token0_contract.address)
    selfdestruct1 = check_self_destruct(web3=web3, contract_address=token1_contract.address)

    # Compute 24h Volume of the pair
    total_volume_token0, total_volume_token1 = get_24h_volume(pair_contract=pair_contract)
    print(50 * '-')
