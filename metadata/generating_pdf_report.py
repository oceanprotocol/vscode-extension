import matplotlib.pyplot as plt
import os
import requests

from reportlab.lib.pagesizes import letter
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

LIST_TABLE_STYLE = TableStyle([
    ('GRID', (1,1), (-1,-1), 0.25, colors.black),
    ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
    ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.black),
    ('BOX', (0,0), (-1,-1), 0.25, colors.black),
])

def extract_results():
    # For reference, check https://github.com/oceanprotocol/stock-api
    stock_data = requests.get('https://stock-api.oceanprotocol.com/stock/stock.json')

    return stock_data["results"]

def get_top_10_closing_prices(results):
    def sort_func(e):
        return e['price']
    
    return sorted(
        map(
            lambda result: {
                "symbol": result['T'],
                "price": result['c']
            },
            results
        ),
        reverse=True,
        key=sort_func
    )[:10]

def get_top_10_trading_volumes(best=True):
    def sort_func(e):
        return e['volume']
    

    return sorted(
        map(
            lambda result: {
                "symbol": result['T'],
                "volume": result['v']
            },
            results
        ),
        reverse=best,
        key=sort_func
    )[:10]

def generate_table_data(top_10_trading_volumes):
    table_top_10_trading_volumes_data = [['Symbol', 'Volume']]

    for trading_volume in top_10_trading_volumes:
        table_top_10_trading_volumes_data.append([trading_volume["symbol"], trading_volume["volume"]])

    return table_top_10_trading_volumes_data



if __name__ == "__main__":

    results = extract_results()
    top_10_closing_prices = get_top_10_closing_prices(results=results)

    categories = [closing_price["symbol"] for closing_price in top_10_closing_prices]
    values = [closing_price["price"] for closing_price in top_10_closing_prices]

    top_10_best_trading_volumes = get_top_10_trading_volumes(best=True)
    top_10_worst_trading_volumes = get_top_10_trading_volumes(best=False)
    table_top_10_best_trading_volumes_data = generate_table_data(top_10_best_trading_volumes)
    table_top_10_worst_trading_volumes_data = generate_table_data(top_10_worst_trading_volumes)

    plt.figure(figsize=(8, 4))
    plt.bar(categories, values)
    
    plt.title('Top 10 Closing Prices')
    plt.xlabel('Stock')
    plt.ylabel('Values')

    # Save the bar chart as an image
    plt.savefig('bar_chart.png')

    # Create a PDF document
    pdf_filename = '/data/outputs/report.pdf'
    c = canvas.Canvas(pdf_filename, pagesize=letter)
    c.setFillColor(colors.grey)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(230, 760, "Stock Report")

    image_path = os.path.join(os.getcwd(), "bar_chart.png")
    c.drawImage(image_path, 50, 400, width=500, height=265)

    c.setFont("Helvetica-Bold", 14)

    c.drawString(50, 270, "Top 10 Best Trading Volumes")
    table_top_10_best_trading_volumes = Table(table_top_10_best_trading_volumes_data)
    table_top_10_best_trading_volumes.setStyle(LIST_TABLE_STYLE)
    table_top_10_best_trading_volumes.wrapOn(c, 200, 350)
    table_top_10_best_trading_volumes.drawOn(c, 150, 20)
    
    c.showPage()
    c.setFillColor(colors.grey)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 760, "Top 10 Worst Trading Volumes")
    table_top_10_worst_trading_volumes = Table(table_top_10_worst_trading_volumes_data)
    table_top_10_worst_trading_volumes.setStyle(LIST_TABLE_STYLE)
    table_top_10_worst_trading_volumes.wrapOn(c, 200, 350)
    table_top_10_worst_trading_volumes.drawOn(c, 170, 475)

    c.save()
    print("PDF report generated successfully.")

    os.remove('bar_chart.png')
    print("PDF report moved to /data/outputs.")