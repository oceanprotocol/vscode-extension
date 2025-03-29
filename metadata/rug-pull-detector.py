import requests
from datetime import datetime

# CoinGecko API endpoint for token details
COINGECKO_API_URL = "https://api.coingecko.com/api/v3/"


# Function to fetch token details by ID
def get_token_details(token_id):
    url = f"{COINGECKO_API_URL}coins/{token_id}"
    response = requests.get(url)

    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error fetching token details for {token_id}. Status Code: {response.status_code}")
        return None


# Function to fetch token pairs from a specific liquidity pool (example: Uniswap or PancakeSwap)
def get_liquidity_pairs():
    # Example of fetching top 100 tokens from CoinGecko for liquidity pool pairs
    url = f"{COINGECKO_API_URL}coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1"
    response = requests.get(url)

    if response.status_code == 200:
        tokens = response.json()
        return tokens
    else:
        print(f"Error fetching token pairs. Status Code: {response.status_code}")
        return None


# Function to calculate the token age based on the creation date
def calculate_token_age(launch_date):
    if not launch_date or launch_date == 'N/A':
        return "N/A"
    try:
        # Try parsing with the expected format (including milliseconds)
        launch_date = datetime.strptime(launch_date, "%Y-%m-%dT%H:%M:%S.%fZ")
    except (ValueError, TypeError):
        try:
            # Fallback to parsing if the date is in the format "YYYY-MM-DD"
            launch_date = datetime.strptime(launch_date, "%Y-%m-%d")
        except ValueError:
            # If the date is still not parsable, return N/A
            return "N/A"

    # Calculate the age if the launch_date is successfully parsed
    current_date = datetime.now()
    age = current_date - launch_date
    return age.days


# Main function to fetch and display token data
def display_token_info():
    tokens = get_liquidity_pairs()

    if tokens:
        for token in tokens:
            token_id = token['id']
            details = get_token_details(token_id)

            if details:
                name = details.get("name", "N/A")
                symbol = details.get("symbol", "N/A")
                launch_date = details.get("genesis_date", "N/A")
                mintable = details.get("is_mintable", "N/A")
                liquidity_pool_pair = f"{token['symbol']}-USD"  # Assuming we get liquidity pair as symbol-USD

                token_age = calculate_token_age(launch_date) if launch_date != "N/A" else "N/A"

                print(f"Token Name: {name}")
                print(f"Token Symbol: {symbol}")
                print(f"Liquidity Pool Pair: {liquidity_pool_pair}")
                print(f"Token Age: {token_age} days")
                print(f"Mintable: {mintable}")
                print("-" * 40)


# Run the script
if __name__ == "__main__":
    display_token_info()
