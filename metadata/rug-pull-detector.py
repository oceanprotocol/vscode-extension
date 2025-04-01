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
                 {"name": "blockTimestampLast", "type": "uint32"}], "stateMutability": "view", "type": "function"}
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
    market_cap_0 = calculate_market_cap(token_contract=token0_contract, token_symbol=token0_symbol, reserve0=reserve0, reserve1=reserve1)
    market_cap_1 = calculate_market_cap(token_contract=token1_contract, token_symbol=token1_symbol, reserve0=reserve0, reserve1=reserve1)
    print(40 * '-')
